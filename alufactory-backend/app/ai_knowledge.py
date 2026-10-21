"""Second-layer retrieval over the owner-approved answer library.

`ai_faq.match_faq` stays the only exact channel: it fails closed on ambiguity and
never guesses a price or a spec. This module adds a deliberately conservative
layer for the wording the owner never typed verbatim:

* it answers only when exactly one rule is clearly the best match;
* categories that carry money or per-account numbers are never answered from a
  fuzzy match, because a near miss there hands a real number to a real customer;
* whatever it cannot answer is recorded, so the owner can see what the site still
  does not know instead of silently guessing.

Nothing here calls a model. It is safe to run on every message.
"""
import hashlib
import re
from datetime import datetime
from difflib import SequenceMatcher

from app.models.user import db
from app.ai_faq import normalize_question
from app.ai_models import AIFaqRule, AIKnowledgeMiss

# Character bigram overlap plus a sequence ratio. Bigrams alone under-score short
# pairs such as 「多久发货」/「多久能发货」, where a single inserted particle
# halves the overlap even though the meaning is identical.
AUTO_ANSWER = 0.68      # below this the configured model handles the question
MIN_SUGGEST = 0.35      # below this it is not even worth showing the owner
AMBIGUITY_GAP = 0.06    # two rules this close means we cannot choose between them
MIN_COVERAGE = 0.55     # share of the question's own bigrams that must appear
MAX_QUERY = 300         # longer inputs are quote requests, not questions

# A fuzzy hit inside these categories could state a wrong amount or a wrong
# balance with full confidence. Exact matching still covers them.
BLOCKED_CATEGORIES = ('报价咨询', '付款与充值', '账户与额度')

QUESTION_WORDS = ('?', '？', '吗', '呢', '怎么', '如何', '多少', '什么', '哪种', '哪个',
                  '能不能', '可不可以', '可以吗', '是不是', '有没有', '区别', '为什么',
                  '几天', '多久', '支持', '包括', '包含')
QUOTE_WORDS = ('报价', '下单', '加入购物车', '要买', '采购', '开单')

# Real questions arrive wrapped in conversation, not as clean strings: staff ask
# 「老板 买家问 X 怎么弄」and customers open with 「请问」/「在吗」. Those wrappers
# are pure noise for similarity — they cost bigram overlap and push a genuinely
# identical question below the auto-answer threshold. Only leading wrappers are
# removed, and only when something substantive is left behind.
WRAPPER_PREFIXES = ('老板', '亲', '你好', '您好', '在吗', '请问', '麻烦问一下', '麻烦问下',
                    '问一下', '想问', '咨询一下', '客服', '买家问', '买家说', '买家要',
                    '买家', '客户问', '客户说', '客户要', '客户', '老板这个', '那请问',
                    '那个', '请问一下')
MIN_STRIPPED_LENGTH = 4  # a wrapper-only remnant is not a question


def _bigrams(text):
    if len(text) < 2:
        return {text} if text else set()
    return {text[i:i + 2] for i in range(len(text) - 1)}


def _strip_wrappers(text):
    """Drop leading conversational wrappers, repeatedly, from a normalized question."""
    text = re.sub(r'@\S+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    changed = True
    while changed:
        changed = False
        for prefix in WRAPPER_PREFIXES:
            if text.startswith(prefix):
                trimmed = text[len(prefix):].lstrip(' :：,，、。')
                if len(trimmed) >= MIN_STRIPPED_LENGTH:
                    text, changed = trimmed, True
                break
    return text


def _queries(message):
    """Both the raw and the wrapper-stripped question, stripped first."""
    raw = normalize_question(message)[:MAX_QUERY]
    stripped = _strip_wrappers(raw)
    return [q for q in dict.fromkeys([stripped, raw]) if q]


def score(query, candidate):
    """Similarity of two already-normalized questions, 0..1."""
    if not query or not candidate:
        return 0.0
    if query == candidate:
        return 1.0
    left, right = _bigrams(query), _bigrams(candidate)
    dice = 2 * len(left & right) / (len(left) + len(right))
    ratio = SequenceMatcher(None, query, candidate, autojunk=False).ratio()
    return round(0.6 * dice + 0.4 * ratio, 4)


def coverage(query, candidate):
    """Share of the question's own bigrams that also appear in the candidate."""
    left = _bigrams(query)
    return round(len(left & _bigrams(candidate)) / len(left), 4) if left else 0.0


def rule_score(query, rule):
    """Best (score, coverage) across the standard question and every alias."""
    best = (0.0, 0.0)
    for phrasing in [rule.question, *(rule.aliases or [])]:
        candidate = normalize_question(phrasing)
        if not candidate:
            continue
        current = (score(query, candidate), coverage(query, candidate))
        if current[0] > best[0]:
            best = current
    return best


def rank(message, limit=3, min_score=MIN_SUGGEST, rules=None):
    """Closest enabled rules, best first. Used for suggestions and for picking."""
    queries = _queries(message)
    if not queries:
        return []
    pool = rules if rules is not None else AIFaqRule.query.filter_by(enabled=True).all()
    scored = []
    for rule in pool:
        best = (0.0, 0.0)
        for query in queries:
            current = rule_score(query, rule)
            if current[0] > best[0]:
                best = current
        if best[0] >= min_score:
            scored.append((rule, best[0], best[1]))
    scored.sort(key=lambda item: (-item[1], item[0].id))
    return scored[:limit]


def answerable(rule):
    """Whether a fuzzy hit may speak for this rule."""
    category = (rule.category or '').strip()
    return bool(rule.enabled) and not any(blocked in category for blocked in BLOCKED_CATEGORIES)


def pick(message):
    """The single rule that may answer this wording, or None to fall through.

    Fails closed exactly like `match_faq`: a close runner-up, a weak overlap, a
    money category or a short question all mean "let the model handle it".
    """
    ranked = rank(message, limit=2)
    if not ranked:
        return None
    rule, best_score, best_coverage = ranked[0]
    if best_score < AUTO_ANSWER or best_coverage < MIN_COVERAGE:
        return None
    if not answerable(rule):
        return None
    if len(ranked) > 1 and ranked[0][1] - ranked[1][1] < AMBIGUITY_GAP:
        return None
    return rule


def references(message, limit=2):
    """Knowledge worth showing the model when we are not confident enough to answer."""
    return [(rule, best) for rule, best, _ in rank(message, limit=limit)]


def looks_like_question(message):
    """Cheap gate so quote requests do not flood the miss queue as 'unanswered'."""
    text = (message or '').strip()
    if not text or len(text) > MAX_QUERY:
        return False
    if any(word in text for word in QUOTE_WORDS):
        return False
    if re.search(r'\d+\s*(mm|毫米|cm|厘米|米)', text, re.I) and re.search(r'\d+\s*(根|个|件|套|支|块)', text):
        return False
    return any(word in text for word in QUESTION_WORDS)


def _key(normalized):
    return hashlib.sha1(normalized.encode('utf-8')).hexdigest()[:32]


def record_miss(message, source='', candidates=None):
    """Upsert one unanswered question. Never raises: logging must not fail a chat."""
    try:
        normalized = normalize_question(message or '')[:MAX_QUERY]
        if not normalized:
            return None
        now = datetime.utcnow()
        payload = [{'rule_id': rule.id, 'question': rule.question, 'score': value}
                   for rule, value in (candidates or [])]
        key = _key(normalized)
        row = db.session.get(AIKnowledgeMiss, key)
        if row is None:
            db.session.add(AIKnowledgeMiss(id=key, question=(message or '').strip()[:1000],
                                           normalized=normalized, count=1, candidates=payload,
                                           status='open', last_source=source,
                                           first_seen_at=now, last_seen_at=now))
        else:
            row.count += 1
            row.question = (message or '').strip()[:1000]
            row.candidates = payload
            row.last_source = source
            row.last_seen_at = now
        db.session.commit()
        return key
    except Exception:
        db.session.rollback()
        return None


def serialize_miss(row):
    return {'id': row.id, 'question': row.question, 'count': row.count,
            'candidates': row.candidates or [], 'status': row.status,
            'last_source': row.last_source,
            'first_seen_at': row.first_seen_at.isoformat() + 'Z',
            'last_seen_at': row.last_seen_at.isoformat() + 'Z'}
