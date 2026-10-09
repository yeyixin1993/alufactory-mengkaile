from datetime import datetime
from app.models.user import db

# Integer units: 1 RMB = 100,000,000 units. Never round each message to cents.
SCALE = 100_000_000

class AIAccount(db.Model):
    __tablename__ = 'ai_accounts'
    id = db.Column(db.String(100), primary_key=True)
    balance = db.Column(db.BigInteger, nullable=False, default=0)
    granted = db.Column(db.BigInteger, nullable=False, default=0)
    trial_used = db.Column(db.Integer, nullable=False, default=0)
    trial_limit = db.Column(db.Integer, nullable=False, default=3)
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    busy = db.Column(db.String(36), nullable=True)
    history = db.Column(db.JSON, nullable=False, default=list)
    # First-touch origin, written once when the account is created. Guests are otherwise
    # anonymous rows keyed by a device token, and the admin chat log has nothing to show
    # to tell one visitor from another.
    first_ip = db.Column(db.String(45), nullable=True)
    first_user_agent = db.Column(db.String(300), nullable=True)
    first_seen_at = db.Column(db.DateTime, nullable=True)

class AISettings(db.Model):
    __tablename__ = 'ai_settings'
    id = db.Column(db.Integer, primary_key=True)
    enabled = db.Column(db.Boolean, nullable=False, default=False)
    markup_bps = db.Column(db.Integer, nullable=False, default=1000)

class AILedger(db.Model):
    __tablename__ = 'ai_ledger'
    id = db.Column(db.String(100), primary_key=True)
    account_id = db.Column(db.String(100), nullable=False, index=True)
    kind = db.Column(db.String(40), nullable=False)
    delta = db.Column(db.BigInteger, nullable=False, default=0)
    api_cost = db.Column(db.BigInteger, nullable=False, default=0)
    detail = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class AIRequest(db.Model):
    __tablename__ = 'ai_requests'
    id = db.Column(db.String(100), primary_key=True)
    account_id = db.Column(db.String(100), nullable=False, index=True)
    status = db.Column(db.String(30), nullable=False, default='pending')
    message = db.Column(db.Text, nullable=False)
    response = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class AIRecharge(db.Model):
    __tablename__ = 'ai_recharges'
    id = db.Column(db.String(70), primary_key=True)
    account_id = db.Column(db.String(100), nullable=False)
    amount_fen = db.Column(db.Integer, nullable=False)
    paid = db.Column(db.Boolean, nullable=False, default=False)
    trade_no = db.Column(db.String(100), unique=True, nullable=True)

class AIRateWindow(db.Model):
    __tablename__ = 'ai_rate_windows'
    id = db.Column(db.String(100), primary_key=True)
    count = db.Column(db.Integer, nullable=False, default=0)


class AIFaqRule(db.Model):
    __tablename__ = 'ai_faq_rules'
    id = db.Column(db.String(64), primary_key=True)
    category = db.Column(db.String(60), nullable=False)
    question = db.Column(db.String(300), nullable=False)
    aliases = db.Column(db.JSON, nullable=False, default=list)
    answer = db.Column(db.Text, nullable=False)
    enabled = db.Column(db.Boolean, nullable=False, default=False)
    notes = db.Column(db.Text, nullable=False, default='')
    source = db.Column(db.String(1000), nullable=False, default='')
    version = db.Column(db.Integer, nullable=False, default=1)
    updated_by = db.Column(db.String(100), nullable=False, default='seed')
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class AIConversation(db.Model):
    __tablename__ = 'ai_conversations'
    id = db.Column(db.String(36), primary_key=True)
    account_id = db.Column(db.String(100), nullable=False, index=True)
    title = db.Column(db.String(100), nullable=False, default='新对话')
    active = db.Column(db.Boolean, nullable=False, default=True)
    context = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class AIConversationMessage(db.Model):
    __tablename__ = 'ai_conversation_messages'
    request_id = db.Column(db.String(100), primary_key=True)
    conversation_id = db.Column(db.String(36), nullable=False, index=True)
    image = db.Column(db.JSON, nullable=True)


class AIWechatApplication(db.Model):
    __tablename__ = 'ai_wechat_applications'
    id = db.Column(db.String(36), primary_key=True)
    account_id = db.Column(db.String(100), nullable=False, index=True)
    amount_fen = db.Column(db.Integer, nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    note = db.Column(db.String(500), nullable=False, default='')
    status = db.Column(db.String(20), nullable=False, default='pending', index=True)
    trade_no = db.Column(db.String(100), unique=True, nullable=True)
    reviewer = db.Column(db.String(100), nullable=True)
    review_note = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
