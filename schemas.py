from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import date, datetime
import re


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_valid(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── Expenses ──────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    amount: float
    category: str
    description: Optional[str] = ""
    date: date
    is_recurring: bool = False
    recurrence_interval: Optional[str] = None
    tags: Optional[List[str]] = []

    @field_validator("amount")
    @classmethod
    def amount_valid(cls, v):
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        if v > 10000000:
            raise ValueError("Amount cannot exceed ₹1,00,00,000")
        return round(v, 2)

    @field_validator("category")
    @classmethod
    def category_valid(cls, v):
        allowed = ["food", "travel", "bills", "entertainment", "health", "shopping", "other"]
        if v not in allowed:
            raise ValueError(f"Category must be one of {allowed}")
        return v

    @field_validator("date")
    @classmethod
    def date_not_future(cls, v):
        if v > date.today():
            raise ValueError("Expense date cannot be in the future")
        return v

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, v):
        if v:
            # Strip HTML tags
            v = re.sub(r'<[^>]+>', '', v)
            v = v.strip()[:500]
        return v

    @field_validator("recurrence_interval")
    @classmethod
    def recurrence_valid(cls, v):
        if v and v not in ["daily", "weekly", "monthly"]:
            raise ValueError("Recurrence must be daily, weekly, or monthly")
        return v


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None
    tags: Optional[List[str]] = None
    is_recurring: Optional[bool] = None
    recurrence_interval: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_valid(cls, v):
        if v is not None:
            if v <= 0:
                raise ValueError("Amount must be greater than 0")
            if v > 10000000:
                raise ValueError("Amount cannot exceed ₹1,00,00,000")
            return round(v, 2)
        return v

    @field_validator("date")
    @classmethod
    def date_not_future(cls, v):
        if v and v > date.today():
            raise ValueError("Expense date cannot be in the future")
        return v


class ExpenseResponse(BaseModel):
    id: int
    amount: float
    category: str
    description: str
    date: date
    is_recurring: bool
    recurrence_interval: Optional[str]
    tags: List[str]
    is_deleted: bool
    edit_history: List[dict]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Budgets ───────────────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    category: str
    amount: float
    month: str  # YYYY-MM
    rollover: bool = False

    @field_validator("amount")
    @classmethod
    def amount_valid(cls, v):
        if v <= 0:
            raise ValueError("Budget must be greater than 0")
        return round(v, 2)

    @field_validator("month")
    @classmethod
    def month_valid(cls, v):
        import re
        if not re.match(r'^\d{4}-\d{2}$', v):
            raise ValueError("Month must be in YYYY-MM format")
        return v


class BudgetResponse(BaseModel):
    id: int
    category: str
    amount: float
    month: str
    rollover: bool

    class Config:
        from_attributes = True


# ── Goals ─────────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    title: str
    target_amount: float
    saved_amount: float = 0.0
    deadline: Optional[date] = None

    @field_validator("target_amount")
    @classmethod
    def target_valid(cls, v):
        if v <= 0:
            raise ValueError("Target amount must be greater than 0")
        return round(v, 2)

    @field_validator("saved_amount")
    @classmethod
    def saved_valid(cls, v):
        if v < 0:
            raise ValueError("Saved amount cannot be negative")
        return round(v, 2)


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    target_amount: Optional[float] = None
    saved_amount: Optional[float] = None
    deadline: Optional[date] = None


class GoalResponse(BaseModel):
    id: int
    title: str
    target_amount: float
    saved_amount: float
    deadline: Optional[date]
    created_at: datetime

    class Config:
        from_attributes = True


# ── AI ────────────────────────────────────────────────────────────────────────

class ValidateRequest(BaseModel):
    description: str
    category: str


class ValidateResponse(BaseModel):
    matches: bool
    message: str
