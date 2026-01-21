"""
Run Flask app with better error handling
"""
import os
from dotenv import load_dotenv

load_dotenv()

from app import create_app

if __name__ == '__main__':
    app = create_app(os.getenv('FLASK_ENV', 'development'))
    # Run without debug to avoid restarting issues
    app.run(
        debug=False,
        host='0.0.0.0',
        port=5000,
        use_reloader=False,
        threaded=True
    )
