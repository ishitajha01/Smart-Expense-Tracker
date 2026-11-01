from django.conf import settings
from django.db import models


class Category(models.Model):
    # A null owner means this is a default category available to everyone.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE
    )
    name = models.CharField(max_length=60)

    class Meta:
        verbose_name_plural = "categories"
        constraints = [
            models.UniqueConstraint(
                models.functions.Lower("name"),
                "owner",
                name="unique_category_name_per_owner",
            )
        ]

    def __str__(self) -> str:
        return str(self.name)


class Transaction(models.Model):
    INCOME = "income"
    EXPENSE = "expense"

    TYPE_CHOICES = [
        (INCOME, "Income"),
        (EXPENSE, "Expense"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    category = models.ForeignKey(
        Category,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    description = models.CharField(max_length=240)

    transaction_date = models.DateField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-transaction_date", "-id"]

    def __str__(self) -> str:
        return f"{self.type} {self.amount} - {self.description}"


class Budget(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="budgets"
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="budgets"
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    month = models.PositiveSmallIntegerField()

    year = models.PositiveSmallIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "-month"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "category", "month", "year"],
                name="unique_monthly_budget_per_category"
            )
        ]

    def __str__(self) -> str:
        return (
            f"{self.category.name} - "
            f"{self.month}/{self.year} - "
            f"{self.amount}"
        )
