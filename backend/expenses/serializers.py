
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework import serializers
from .models import Budget, Category, Transaction

User = get_user_model()


# --------------------------------------------------
# USER REGISTRATION SERIALIZER
# --------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


# --------------------------------------------------
# CATEGORY SERIALIZER
# --------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "owner")
        read_only_fields = ("owner",)

    def validate_name(self, value):
        user = self.context["request"].user

        # Check whether this user already has a category
        # with the same name, ignoring capitalization.
        existing = Category.objects.filter(
            owner=user,
            name__iexact=value.strip()
        )

        # During updates, don't treat the current category
        # as a duplicate of itself.
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)

        if existing.exists():
            raise serializers.ValidationError(
                "You already have a category with this name."
            )

        return value.strip()

# --------------------------------------------------
# TRANSACTION SERIALIZER
# --------------------------------------------------


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = (
            "id",
            "category",
            "type",
            "amount",
            "description",
            "transaction_date",
            "created_at",
        )

        read_only_fields = ("created_at",)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Amount must be greater than 0."
            )
        return value

    def validate_category(self, value):
        user = self.context["request"].user

        # Users can select default categories or their own.
        if value is not None and value.owner_id not in (None, user.id):
            raise serializers.ValidationError("Invalid category.")

        return value


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True
    )

    spent = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    percentage_used = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = (
            "id",
            "category",
            "category_name",
            "amount",
            "month",
            "year",
            "spent",
            "remaining",
            "percentage_used",
            "created_at",
            "owner",
        )
        read_only_fields = (
            "id",
            "category_name",
            "spent",
            "remaining",
            "percentage_used",
            "created_at",
            "owner",
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Budget amount must be greater than zero."
            )
        return value

    def validate_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError(
                "Month must be between 1 and 12."
            )
        return value

    def validate_year(self, value):
        if not 2000 <= value <= 2100:
            raise serializers.ValidationError(
                "Please enter a valid budget year."
            )
        return value

    def validate_category(self, value):
        user = self.context["request"].user

        if value.owner is not None and value.owner != user:
            raise serializers.ValidationError(
                "You cannot create a budget for another user's category."
            )

        return value

    def validate(self, attrs):
        user = self.context["request"].user

        category = attrs.get(
            "category",
            getattr(self.instance, "category", None)
        )
        month = attrs.get(
            "month",
            getattr(self.instance, "month", None)
        )
        year = attrs.get(
            "year",
            getattr(self.instance, "year", None)
        )

        existing = Budget.objects.filter(
            owner=user,
            category=category,
            month=month,
            year=year
        )

        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)

        if existing.exists():
            raise serializers.ValidationError({
                "category": (
                    "A budget already exists for this category "
                    "for the selected month."
                )
            })

        return attrs

    def get_spent(self, budget):
        result = Transaction.objects.filter(
            owner=budget.owner,
            category=budget.category,
            type="expense",
            transaction_date__year=budget.year,
            transaction_date__month=budget.month
        ).aggregate(total=Sum("amount"))

        return result["total"] or Decimal("0.00")

    def get_remaining(self, budget):
        return budget.amount - self.get_spent(budget)

    def get_percentage_used(self, budget):
        spent = self.get_spent(budget)

        if budget.amount == 0:
            return 0

        return round(float(spent / budget.amount * 100), 2)
