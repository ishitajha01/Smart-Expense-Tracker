
from datetime import date

from django.db.models import Sum, Q, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Transaction


def get_dashboard_summary(user, month=None, year=None):
    """
    Calculate dashboard financial summaries
    for the given authenticated user.
    """

    today = timezone.localdate()
    month = month or today.month
    year = year or today.year
    month_start = date(year, month, 1)
    month_end = (
        date(year + 1, 1, 1)
        if month == 12
        else date(year, month + 1, 1)
    )

    # Only retrieve transactions belonging to this user.
    transactions = Transaction.objects.filter(
        owner=user,
        transaction_date__gte=month_start,
        transaction_date__lt=month_end,
    )

    # Totals and category breakdowns are scoped to the requested month.
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

    monthly = transactions.aggregate(
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
        "period": {"month": month, "year": year},
        "category_expenses": [
            {
                "category": item["category__name"] or "Uncategorized",
                "total": item["total"],
            }
            for item in category_expenses
        ],
    }
