from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
from routers import auth, expenses, budgets, goals, insights, reports
from services.recurring import process_recurring_expenses
from database import SessionLocal

# Create all tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Expense Tracker", version="1.0.0")

# CORS — allow frontend to talk to backend during local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(expenses.router)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(insights.router)
app.include_router(reports.router)

# Serve frontend
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def serve_frontend():
    return FileResponse("static/index.html")


@app.on_event("startup")
def startup():
    """Process any due recurring expenses on startup."""
    db = SessionLocal()
    try:
        process_recurring_expenses(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
