#!/usr/bin/env python
"""Bulk-load the owner's own answers into the AI answer library as drafts.

The customer-service group is where the real questions live, but the wording in
it is repetitive and inconsistent. This script turns a plain CSV into DRAFT
entries that the owner reviews one by one at /admin/ai-faq.html — nothing is
published unless `--publish` is passed, because a wrong answer on a spec or a
policy is worse than no answer at all.

CSV columns (header required, order free): 问题, 答案, 同义问法, 分类, 备注
`同义问法` may hold several phrasings separated by | or 、

Ids are derived from the question text, so re-running the same file updates
nothing twice and the run is safe to repeat.

Usage:
  python import_ai_knowledge.py qa.csv --category 常见问题 --dry-run
  python import_ai_knowledge.py qa.csv --category 常见问题 --publish
  python import_ai_knowledge.py qa.csv --database sqlite:///instance/alufactory-local.db
"""
import argparse
import csv
import hashlib
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BACKEND_DIR / 'instance'
COLUMNS = ('问题', '答案', '同义问法', '分类', '备注')


def configure_environment(database_url):
    os.environ.setdefault('FLASK_ENV', 'development')
    os.environ['DATABASE_URL'] = database_url or f"sqlite:///{INSTANCE_DIR / 'alufactory-local.db'}"
    os.environ.setdefault('SECRET_KEY', 'alufactory-ai-knowledge-import')
    os.environ.setdefault('JWT_SECRET_KEY', 'alufactory-ai-knowledge-import-jwt')
    os.environ['ENABLE_MAYCAD_AI_IMPORT'] = '0'


def read_rows(path):
    with open(path, encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        missing = [name for name in COLUMNS[:2] if name not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f'CSV 缺少必需列：{"、".join(missing)}。表头应为：{",".join(COLUMNS)}')
        return [{(key or '').strip(): (value or '').strip() for key, value in row.items()} for row in reader]


def split_aliases(raw):
    for separator in ('|', '、', '\n'):
        raw = raw.replace(separator, '\n')
    return [line.strip() for line in raw.split('\n') if line.strip()]


def rule_id(question):
    return 'kb-' + hashlib.sha1(question.encode('utf-8')).hexdigest()[:10]


def main():
    parser = argparse.ArgumentParser(description='把问答 CSV 导入 AI 问答规则库（默认只写入草稿）')
    parser.add_argument('csv_path')
    parser.add_argument('--category', default='常见问题', help='CSV 未填分类时使用的分类')
    parser.add_argument('--publish', action='store_true', help='直接启用（默认导入为未启用草稿）')
    parser.add_argument('--update', action='store_true', help='覆盖已存在条目的答案与同义问法')
    parser.add_argument('--dry-run', action='store_true', help='只检查不写库')
    parser.add_argument('--database', default='', help='DATABASE_URL，默认本地 instance/alufactory-local.db')
    args = parser.parse_args()

    path = Path(args.csv_path).expanduser()
    if not path.exists():
        raise SystemExit(f'找不到文件：{path}')
    rows = read_rows(path)
    configure_environment(args.database)

    from app import create_app  # noqa: E402
    from app.models.user import db  # noqa: E402
    from app.ai_models import AIFaqRule  # noqa: E402
    from app.ai_faq import normalize_question  # noqa: E402

    app = create_app('development')
    added = skipped = updated = 0
    conflicts = []
    with app.app_context():
        taken = {normalize_question(rule.question): rule.id for rule in AIFaqRule.query.all()}
        for rule in AIFaqRule.query.all():
            for alias in rule.aliases or []:
                taken.setdefault(normalize_question(alias), rule.id)
        for index, row in enumerate(rows, start=2):
            question = row.get('问题', '')
            answer = row.get('答案', '')
            if not question or not answer:
                conflicts.append(f'第 {index} 行：问题和答案都必须填写，已跳过。')
                continue
            entry_id = rule_id(question)
            existing = db.session.get(AIFaqRule, entry_id)
            aliases = split_aliases(row.get('同义问法', ''))
            if existing and not args.update:
                skipped += 1
                continue
            clash = next((taken[normalize_question(q)] for q in [question, *aliases]
                          if normalize_question(q) in taken and taken[normalize_question(q)] != entry_id), None)
            if clash:
                conflicts.append(f'第 {index} 行：问法与已存在的 {clash} 重复，已跳过。')
                continue
            if args.dry_run:
                added += 1
                continue
            payload = {'category': row.get('分类') or args.category, 'question': question,
                       'aliases': aliases, 'answer': answer,
                       'notes': row.get('备注', ''), 'source': f'import:{path.name}',
                       'updated_by': 'import_ai_knowledge',
                       'enabled': bool(args.publish)}
            if existing:
                existing.category = payload['category']
                existing.aliases = aliases
                existing.answer = answer
                existing.notes = payload['notes']
                existing.source = payload['source']
                existing.enabled = payload['enabled'] if args.publish else existing.enabled
                existing.version += 1
                updated += 1
            else:
                db.session.add(AIFaqRule(id=entry_id, version=1, **payload))
                added += 1
            for text in [question, *aliases]:
                taken[normalize_question(text)] = entry_id
        if not args.dry_run:
            db.session.commit()

    verb = '将写入' if args.dry_run else '已写入'
    print(f'{verb} {added} 条，跳过 {skipped} 条（已存在），更新 {updated} 条。')
    if not args.publish:
        print('都是未启用草稿：去 /admin/ai-faq.html 逐条核对答案，勾选启用后才会对客户生效。')
    for line in conflicts:
        print('  · ' + line)
    if conflicts:
        print(f'有 {len(conflicts)} 行未导入，请修正后重跑。')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
