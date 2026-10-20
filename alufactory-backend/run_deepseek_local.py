"""Explicit real-API local mode. Local data only; payment endpoints disabled."""
import os
import secrets
from pathlib import Path
from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / '.env.deepseek.local'
INSTANCE_DIR = BACKEND_DIR / 'instance' / 'deepseek-local'


def build_app():
    values = dotenv_values(ENV_FILE)
    key = (values.get('DEEPSEEK_API_KEY') or '').strip()
    if not key or key == 'PASTE_YOUR_KEY_HERE':
        raise ValueError('请先在 alufactory-backend/.env.deepseek.local 填写 DEEPSEEK_API_KEY；不要把密钥发到聊天里。')
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    secret_file = INSTANCE_DIR / 'session-secret.local'
    if not secret_file.exists():
        with secret_file.open('x') as f:
            os.chmod(secret_file, 0o600)
            f.write(secrets.token_hex(32))
    secret = secret_file.read_text().strip()
    os.environ.update(AI_PROVIDER='deepseek', DEEPSEEK_API_KEY=key,
        DATABASE_URL=f"sqlite:///{INSTANCE_DIR / 'ai-test.db'}",
        SECRET_KEY=secret, JWT_SECRET_KEY=secret, ENABLE_MAYCAD_AI_IMPORT='0')
    os.environ.pop('DASHSCOPE_API_KEY', None)
    # Import only after setting isolated DB and credentials (config reads env at import).
    from app import create_app
    from app.models.user import db
    from app.ai_models import AISettings
    from flask import request, jsonify
    app = create_app('development', instance_path=str(INSTANCE_DIR))
    app.config.update(DEBUG=False, AI_LOCAL_UNLIMITED=True)
    @app.before_request
    def no_local_payments():
        if request.path.startswith('/api/payments') or request.path.startswith('/api/ai/recharge'):
            return jsonify(error='本地 AI 测试模式不支持真实充值或支付。'), 403
    with app.app_context():
        row = db.session.get(AISettings, 1)
        if row is None:
            row = AISettings(id=1, enabled=True, markup_bps=1000)
            db.session.add(row)
        else:
            row.enabled = True
        db.session.commit()
    return app


if __name__ == '__main__':
    try:
        app = build_app()
    except ValueError as exc:
        print(str(exc))
        raise SystemExit(1)
    print('本地 DeepSeek 测试：真实 API 按量收费；数据库独立；支付接口关闭。')
    app.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)
