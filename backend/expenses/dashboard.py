
from datetime import date

from django.db.models import Sum, Q, DecimalField, Value
from django.db.models.functions import Coalesce
from django.db.models import DecimalField, Value

from .models import Transaction


def get_dashboard_summary(user):
    """
    Calculate dashboard financial summaries
    for the given authenticated user.
    """

    today = date.today()

    # First day of the current month.
    month_start = today.replace(day=1)

    # Only retrieve transactions belonging to this user.
    transactions = Transaction.objects.filter(
        owner=user)  # type: ignore[attr-defined]

    # Calculate all-time income and expenses.
    totals = transactions.aggregate(
        total_income=Coalesce(
            Sum("amount", filter=Q(type=Transaction.INCOME)),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
        total_expenses=Coalesce(
            Sum("amount", filter=Q(type=Transaction.EXPENSE)),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
    )

    # Calculate current month's income and expenses.
    monthly_transactions = transactions.filter(
        transaction_date__gte=month_start,
        transaction_date__lte=today,
    )

    monthly = monthly_transactions.aggregate(
        income=Coalesce(
            Sum("amount", filter=Q(type=Transaction.INCOME)),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
        expenses=Coalesce(
            Sum("amount", filter=Q(type=Transaction.EXPENSE)),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
    )

    # Group expenses by category.
    category_expenses = (
        transactions
        .filter(type=Transaction.EXPENSE)
        .values("category__name")
        .annotate(total=Sum("amount"))
        .order_by("-total")
    )

    return {
        "total_income": totals["total_income"],
        "total_expenses": totals["total_expenses"],
        "balance": totals["total_income"] - totals["total_expenses"],
        "monthly": monthly,
        "category_expenses": [
            {
                "category": item["category__name"] or "Uncategorized",
                "total": item["total"],
            }
            for item in category_expenses
        ],
    }
