from django.db.models import Sum
from django.utils import timezone

from expenses.models import Budget, Transaction

from .models import Conversation
from .prompts import SYSTEM_PROMPT
from .providers.gemini import GeminiProvider


def financial_context(user, month=None, year=None):
    today = timezone.localdate()
    month = month or today.month
    year = year or today.year
    transactions = Transaction.objects.filter(
        owner=user, transaction_date__year=year,
        transaction_date__month=month,
    ).select_related("category")
    expenses = transactions.filter(type=Transaction.EXPENSE)
    income = transactions.filter(type=Transaction.INCOME)
    category_totals = list(
        expenses.values("category__name").annotate(total=Sum("amount")).order_by("-total")[:8]
    )
    budgets = Budget.objects.filter(
        owner=user, month=month, year=year
    ).select_related("category")
    budget_data = []
    for budget in budgets:
        spent = expenses.filter(category=budget.category).aggregate(total=Sum("amount"))["total"] or 0
        budget_data.append({
            "category": budget.category.name,
            "limit": str(budget.amount),
            "spent": str(spent),
        })
    income_total = income.aggregate(total=Sum("amount"))["total"] or 0
    expense_total = expenses.aggregate(total=Sum("amount"))["total"] or 0
    return (
        f"Selected dashboard month: {today.replace(year=year, month=month, day=1).strftime('%B %Y')}\n"
        f"Recorded income: ₹{income_total}; recorded expenses: ₹{expense_total}.\n"
        f"Largest expense categories: {category_totals or 'No expenses recorded.'}\n"
        f"Current-month budgets (limit and spent): {budget_data or 'No budgets set.'}"
    )


def respond(user, conversation, message, month=None, year=None):
    history = (
        list(conversation.messages.order_by("created_at", "id").values("role", "content"))[-11:]
        if conversation.pk else []
    )
    history.append({"role": "user", "content": message})
    prompt = f"{SYSTEM_PROMPT}\n\nAuthenticated user's account context:\n{financial_context(user, month, year)}"
    return GeminiProvider().generate_reply(history, prompt)
