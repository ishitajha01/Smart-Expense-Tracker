from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Category, Transaction


User = get_user_model()


class DashboardSummaryTests(APITestCase):

    def setUp(self):
        # Create two separate users
        self.user = User.objects.create_user(
            username="dashboard_user",
            password="TestPassword123"
        )

        self.other_user = User.objects.create_user(
            username="other_user",
            password="TestPassword123"
        )

        # Create a category for the first user
        self.food_category = Category.objects.create(
            owner=self.user,
            name="Food"
        )

        # Create transactions belonging to the first user
        Transaction.objects.create(
            owner=self.user,
            type=Transaction.INCOME,
            amount=Decimal("5000.00"),
            description="Salary",
            transaction_date=date.today()
        )

        Transaction.objects.create(
            owner=self.user,
            type=Transaction.EXPENSE,
            amount=Decimal("1200.00"),
            description="Groceries",
            transaction_date=date.today(),
            category=self.food_category
        )

        # Create a transaction belonging to another user
        Transaction.objects.create(
            owner=self.other_user,
            type=Transaction.EXPENSE,
            amount=Decimal("9000.00"),
            description="Private expense",
            transaction_date=date.today()
        )

    def test_dashboard_calculates_totals(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            Decimal(str(response.data["total_income"])),
            Decimal("5000.00")
        )
        self.assertEqual(
            Decimal(str(response.data["total_expenses"])),
            Decimal("1200.00")
        )
        self.assertEqual(
            Decimal(str(response.data["balance"])),
            Decimal("3800.00")
        )

    def test_dashboard_calculates_monthly_totals(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            Decimal(str(response.data["monthly"]["income"])),
            Decimal("5000.00")
        )
        self.assertEqual(
            Decimal(str(response.data["monthly"]["expenses"])),
            Decimal("1200.00")
        )

    def test_dashboard_groups_expenses_by_category(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, 200)

        categories = response.data["category_expenses"]

        self.assertEqual(len(categories), 1)
        self.assertEqual(categories[0]["category"], "Food")
        self.assertEqual(
            Decimal(str(categories[0]["total"])),
            Decimal("1200.00")
        )

    def test_dashboard_only_shows_current_users_data(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, 200)

        # The other user's ₹9,000 expense must not appear.
        self.assertEqual(
            Decimal(str(response.data["total_expenses"])),
            Decimal("1200.00")
        )

    def test_dashboard_returns_zero_for_user_with_no_transactions(self):
        new_user = User.objects.create_user(
            username="new_user",
            password="TestPassword123"
        )

        self.client.force_authenticate(user=new_user)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_income"], 0)
        self.assertEqual(response.data["total_expenses"], 0)
        self.assertEqual(response.data["balance"], 0)
        self.assertEqual(response.data["monthly"]["income"], 0)
        self.assertEqual(response.data["monthly"]["expenses"], 0)
        self.assertEqual(response.data["category_expenses"], [])
