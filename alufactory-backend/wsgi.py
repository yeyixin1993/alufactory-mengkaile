"""Production entrypoint: gunicorn --timeout 120 --bind 127.0.0.1:5000 wsgi:app."""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env.deepseek.production'))
load_dotenv(Path(__file__).with_name('.env'))
from app import create_app
app = create_app('production')
