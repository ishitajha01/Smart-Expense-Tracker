from django.contrib import admin
from .models import Category, Transaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "owner")
    search_fields = ("name",)
    list_filter = ("owner",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "description",
        "type",
        "amount",
        "category",
        "owner",
        "transaction_date",
    )

    list_filter = (
        "type",
        "category",
        "transaction_date",
    )

    search_fields = (
        "description",
        "owner__username",
        "category__name",
    )

    date_hierarchy = "transaction_date"
    ordering = ("-transaction_date",)
