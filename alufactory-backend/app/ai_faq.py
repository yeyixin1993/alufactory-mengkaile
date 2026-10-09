"""Owner-maintained exact-question answers. Never fuzzy-match prices or specs."""
import json
import re
import unicodedata
from pathlib import Path
from sqlalchemy.exc import IntegrityError
from app.models.user import db
from app.ai_models import AIFaqRule

SEED_PATH = Path(__file__).with_name('ai_faq_seed.json')
SEED_RULES = json.loads(SEED_PATH.read_text(encoding='utf-8'))
LEGACY_DRAFTS = json.loads(SEED_PATH.with_name('ai_faq_legacy_drafts.json').read_text(encoding='utf-8'))


def normalize_question(text):
    # Ignore harmless whitespace, case and sentence punctuation only. Preserve
    # digits, signs, negation and word order: "不要攻丝" must not match "要攻丝".
    text = unicodedata.normalize('NFKC', text).casefold().strip()
    return re.sub(r'\s+', '', text).rstrip('，,。.!！?？；;：:')


def rule_questions(rule):
    return {normalize_question(q) for q in [rule.question, *rule.aliases]}


def serialize_rule(rule):
    return {'id': rule.id, 'category': rule.category, 'question': rule.question,
            'aliases': rule.aliases, 'answer': rule.answer, 'enabled': rule.enabled,
            'notes': rule.notes, 'source': rule.source, 'version': rule.version,
            'updated_by': rule.updated_by, 'updated_at': rule.updated_at.isoformat()+'Z'}


def match_faq(message):
    target = normalize_question(message)
    if not target:
        return None
    matches = [r for r in AIFaqRule.query.filter_by(enabled=True).all() if target in rule_questions(r)]
    # Concurrent edits could create ambiguous aliases. Fail closed instead of
    # choosing an arbitrary answer; admin preview exposes the conflict.
    return matches[0] if len(matches) == 1 else None


def seed_faq_rules():
    """Insert missing rules; upgrade only untouched legacy policy placeholders."""
    for entry in SEED_RULES:
        existing = db.session.get(AIFaqRule, entry['id'])
        if existing is not None:
            legacy = next((r for r in LEGACY_DRAFTS if r['id'] == entry['id']
                           and all(getattr(existing, key) == value for key, value in r.items())), None)
            if (legacy and entry != legacy and (existing.version, existing.updated_by) in ((1, 'seed'), (2, 'seed-policy-2026-10-03'))
                    and all(getattr(existing, key) == value for key, value in legacy.items())):
                # Compare-and-swap also preserves edits racing this startup.
                AIFaqRule.query.filter_by(id=entry['id'], version=existing.version, updated_by=existing.updated_by).update(
                    {**entry, 'version': existing.version + 1, 'updated_by': 'seed-policy-2026-10-03'}, synchronize_session=False)
                db.session.commit()
                db.session.expire_all()
            continue
        db.session.add(AIFaqRule(**entry))
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()


def validate_rule(data, excluding_id=None):
    fields = {}
    for name, limit, required in [('category',60,True), ('question',300,True), ('answer',6000,True), ('notes',3000,False), ('source',1000,False)]:
        value = data.get(name, '')
        if not isinstance(value, str) or len(value.strip()) > limit or (required and not value.strip()):
            raise ValueError(f'{name} 不能为空或超过长度限制。' if required else f'{name} 格式或长度不正确。')
        fields[name] = value.strip()
    aliases = data.get('aliases', [])
    if not isinstance(aliases, list) or len(aliases) > 30 or any(not isinstance(q,str) or not 1 <= len(q.strip()) <= 300 for q in aliases):
        raise ValueError('同义问法最多 30 条，每条 1–300 字。')
    if type(data.get('enabled')) is not bool:
        raise ValueError('请明确启用或停用。')
    fields['aliases'] = list(dict.fromkeys(q.strip() for q in aliases))
    fields['enabled'] = data['enabled']
    normalized = {normalize_question(q) for q in [fields['question'], *fields['aliases']]}
    if '' in normalized:
        raise ValueError('问题不能只包含标点。')
    if fields['enabled']:
        if any(not entry['enabled'] and fields['answer'] == entry['answer'] for entry in [*SEED_RULES, *LEGACY_DRAFTS]):
            raise ValueError('这仍是待补充的政策模板，请先填写确认过的正式回答，再启用。')
        for rule in AIFaqRule.query.filter_by(enabled=True).all():
            if rule.id != excluding_id and normalized & rule_questions(rule):
                raise ValueError('问法与已启用条目重复：' + rule.question)
    return fields
