"""Run an isolated local backend for frontend development and smoke tests.

This entry point deliberately ignores production database and payment settings.
The local SQLite database and uploaded PDFs stay under the ignored instance/
directory, and port 5001 avoids macOS AirPlay's common port-5000 conflict.
"""

import os
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BACKEND_DIR / "instance"
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

os.environ["FLASK_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{INSTANCE_DIR / 'alufactory-local.db'}"
os.environ["SECRET_KEY"] = "alufactory-local-development-only"
os.environ["JWT_SECRET_KEY"] = "alufactory-local-jwt-development-only"
os.environ["VITE_API_URL"] = "http://127.0.0.1:5001/api"
os.environ.pop("ALIPAY_PUBLIC_BASE_URL", None)
os.environ["ENABLE_MAYCAD_AI_IMPORT"] = "0"
os.environ.pop("DASHSCOPE_API_KEY", None)

from app import create_app  # noqa: E402


app = create_app("development")


if __name__ == "__main__":
    port = int(os.getenv("LOCAL_BACKEND_PORT", "5001"))
    app.run(debug=False, use_reloader=False, host="127.0.0.1", port=port)
