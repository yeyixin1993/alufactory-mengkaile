"""Provider selection and versioned RMB tariffs; never expose credentials."""
import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_CEILING
from app.ai_models import SCALE

QWEN_MODEL = 'qwen3.7-flash-2026-07-15'
DEEPSEEK_MODEL = 'deepseek-flash'
BEIJING = timezone(timedelta(hours=8))
# 2026 State Council holiday schedule. Weekends remain off-peak even on make-up days.
HOLIDAYS_2026 = {(month, day) for month, start, end in
                [(1,1,3),(2,15,23),(4,4,6),(5,1,5),(6,19,21),(9,25,27),(10,1,7)]
                for day in range(start,end+1)}


def provider_name():
    return os.getenv('AI_PROVIDER', 'qwen').strip().lower()


def model_name():
    return {'qwen': QWEN_MODEL, 'deepseek': DEEPSEEK_MODEL}.get(provider_name(), 'unsupported')


def is_configured():
    if provider_name() == 'deepseek':
        return bool(os.getenv('DEEPSEEK_API_KEY', '').strip())
    return provider_name() == 'qwen' and bool(os.getenv('DASHSCOPE_API_KEY') and os.getenv('AI_QWEN_BASE_URL'))


def connection():
    if provider_name() == 'deepseek':
        return 'https://api.deepseek.com', os.environ['DEEPSEEK_API_KEY']
    if provider_name() == 'qwen':
        return os.environ['AI_QWEN_BASE_URL'].rstrip('/'), os.environ['DASHSCOPE_API_KEY']
    raise ValueError('AI 服务商配置不正确。')


def maximum_cost():
    # Full 32K uncached input + 800 output at the highest applicable tariff.
    return Decimal('0.0704') if provider_name() == 'deepseek' else Decimal('0.00704')


def deepseek_period(timestamp):
    dt = datetime.fromtimestamp(timestamp, BEIJING)
    if dt.year != 2026:
        raise RuntimeError('DeepSeek tariff calendar needs annual review')
    peak = dt.weekday() < 5 and (dt.month, dt.day) not in HOLIDAYS_2026 and (9 <= dt.hour < 12 or 14 <= dt.hour < 18)
    return 'peak' if peak else 'off_peak'


def deepseek_cost(result, started, finished):
    usage = result.get('usage') or {}
    incoming, outgoing = usage.get('prompt_tokens'), usage.get('completion_tokens')
    cached = usage.get('prompt_cache_hit_tokens', (usage.get('prompt_tokens_details') or {}).get('cached_tokens'))
    miss = usage.get('prompt_cache_miss_tokens')
    if (type(incoming) is not int or not 0 <= incoming <= 32000 or
            type(outgoing) is not int or not 0 <= outgoing <= 800 or
            type(cached) is not int or not 0 <= cached <= incoming):
        raise RuntimeError('DeepSeek usage requires reconciliation')
    details = (usage.get('prompt_tokens_details') or {}).get('cached_tokens', cached)
    if type(details) is not int or details != cached or (miss is not None and (type(miss) is not int or miss != incoming-cached)):
        raise RuntimeError('DeepSeek cache breakdown inconsistent')
    created = result.get('created')
    if type(created) is not int or not started-60 <= created <= finished+60:
        raise RuntimeError('DeepSeek response timestamp requires reconciliation')
    periods = {deepseek_period(t) for t in (started-60, created, finished+60)}
    if len(periods) != 1:
        raise RuntimeError('DeepSeek tariff boundary requires reconciliation')
    period = periods.pop()
    rates = ('2', '.04', '8') if period == 'peak' else ('1', '.02', '4')
    cost = int(((Decimal(incoming-cached)*Decimal(rates[0])+Decimal(cached)*Decimal(rates[1])+Decimal(outgoing)*Decimal(rates[2]))*SCALE/1_000_000).to_integral_value(rounding=ROUND_CEILING))
    return cost, {**usage, 'billing': {'provider': 'deepseek', 'model': DEEPSEEK_MODEL,
        'returned_model': result.get('model'), 'response_id': result.get('id'), 'created': created,
        'period': period, 'rates_cny_per_million': list(rates), 'tariff_version': '2026-10-04'}}
