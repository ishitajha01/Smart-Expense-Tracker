
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Category, Transaction

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
