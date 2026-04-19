# Run these commands to set up the database:
# 
# 1. Install dependencies:
#    pip install -r requirements.txt
#
# 2. Copy .env.example to .env and fill in your values:
#    cp .env.example .env
#
# 3. Run the app (tables are auto-created on startup):
#    uvicorn main:app --reload
#
# 4. Visit http://localhost:8000
#
# ── DEPLOYMENT ON RENDER ──────────────────────────────────────────────────────
#
# 1. Push this folder to a GitHub repo
#
# 2. Go to render.com → New → Web Service
#    - Connect your GitHub repo
#    - Build command: pip install -r requirements.txt
#    - Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
#
# 3. Add a PostgreSQL database on Render (free tier)
#    - Copy the "Internal Database URL" 
#    - Add it as environment variable DATABASE_URL in your web service
#
# 4. Add all other env variables in Render dashboard:
#    - JWT_SECRET (generate a random string)
#    - GEMINI_API_KEY (from aistudio.google.com)
#
# 5. Deploy — Render auto-deploys on every git push
