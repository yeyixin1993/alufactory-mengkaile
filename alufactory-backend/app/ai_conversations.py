"""Persistent conversation archive, separate from bounded model context."""
import uuid
from sqlalchemy.exc import IntegrityError
from app.models.user import db
from app.ai_models import AIAccount, AIConversation, AIConversationMessage, AIRequest

def _initialize_conversation(account):
    current = AIConversation.query.filter_by(account_id=account.id, active=True).first()
    if current: return current
    current = AIConversation(id=str(uuid.uuid5(uuid.NAMESPACE_URL, 'ai-history:'+account.id)), account_id=account.id, context=list(account.history or []))
    db.session.add(current)
    # Preserve legacy requests; never delete them when creating a new chat.
    rows = AIRequest.query.filter_by(account_id=account.id).order_by(AIRequest.created_at).all()
    for row in rows:
        if not db.session.get(AIConversationMessage, row.id):
            db.session.add(AIConversationMessage(request_id=row.id, conversation_id=current.id))
    if rows:
        current.title = rows[0].message.split('\n[图片:')[0][:60] or '图片咨询'
        current.updated_at = rows[-1].created_at
        if not account.history:
            response=rows[-1].response or {}
            quote=response.get('quote') or {}
            state=quote.get('source_spec') or quote.get('spec')
            if state:
                import json
                account.history=[{'role':'user','content':rows[-1].message.split('\n[图片:')[0]},{'role':'assistant','content':json.dumps(state,ensure_ascii=False)}]
                current.context=list(account.history)
    db.session.flush()
    return current

def current_conversation(account):
    current = AIConversation.query.filter_by(account_id=account.id, active=True).first()
    if current: return current
    # Two tabs may request status simultaneously during first-time recovery.
    try:
        with db.session.begin_nested():
            return _initialize_conversation(account)
    except IntegrityError:
        current = AIConversation.query.filter_by(account_id=account.id, active=True).first()
        if current: return current
        raise

def conversation_requests(account):
    current = current_conversation(account)
    return AIRequest.query.join(AIConversationMessage, AIRequest.id == AIConversationMessage.request_id).filter(AIRequest.account_id == account.id, AIConversationMessage.conversation_id == current.id)

def latest_request(account):
    return conversation_requests(account).filter(AIRequest.status == 'completed').order_by(AIRequest.created_at.desc()).first()

def transcript(account):
    history=[]
    for row in conversation_requests(account).filter(AIRequest.status.in_(['completed','invalid','failed','reconcile','closed'])).order_by(AIRequest.created_at,AIRequest.id).all():
        response=row.response or {}
        link=db.session.get(AIConversationMessage,row.id)
        history.extend([{'role':'user','content':row.message.split('\n[图片:')[0], 'image':link.image if isinstance(link.image,str) else None, 'attachments':link.image if isinstance(link.image,list) else []},
            {'role':'assistant','content':response.get('reply',''), 'quote':response.get('quote'), 'request_id':row.id.rsplit(':',1)[-1], 'review':response.get('review'), 'order_confirmed':response.get('order_confirmed',[]), 'order_revision':response.get('order_revision',0)}])
    return history

def conversation_list(account):
    return [{'id':c.id,'title':c.title,'updated_at':c.updated_at.isoformat()+'Z'} for c in AIConversation.query.filter_by(account_id=account.id).order_by(AIConversation.updated_at.desc()).all()]


def adopt_orphan_requests(limit=500):
    """Give pre-archive requests a home so the admin chat log can never hide a question.

    A request only gains its conversation link when its owner is next touched (see
    _initialize_conversation, which /status triggers). The audit view must not wait for that:
    an account whose owner never comes back would otherwise keep its questions invisible to
    the shop forever. Idempotent, and bounded so one read never walks the whole table.
    """
    orphans = AIRequest.query.outerjoin(AIConversationMessage, AIRequest.id == AIConversationMessage.request_id) \
        .filter(AIConversationMessage.request_id.is_(None)).order_by(AIRequest.created_at).limit(limit).all()
    adopted = 0
    for account_id in dict.fromkeys(row.account_id for row in orphans):
        account = db.session.get(AIAccount, account_id)
        if account is None:
            continue
        conversation = current_conversation(account)
        for request in orphans:
            if request.account_id == account_id and db.session.get(AIConversationMessage, request.id) is None:
                db.session.add(AIConversationMessage(request_id=request.id, conversation_id=conversation.id))
        adopted += 1
    if adopted:
        db.session.commit()
    return adopted
