
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response

from .dashboard import get_dashboard_summary

from .models import Budget, Category, Transaction
from .serializers import (
    BudgetSerializer,
    CategorySerializer,
    RegisterSerializer,
    TransactionSerializer,
)


# --------------------------------------------------
# USER REGISTRATION
# --------------------------------------------------

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


# --------------------------------------------------
# CATEGORY API
# --------------------------------------------------

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        user = self.request.user

        if self.action in ("list", "retrieve"):
            return Category.objects.filter(
                Q(owner=user) | Q(owner__isnull=True)
            )

        return Category.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


# --------------------------------------------------
# TRANSACTION API
# --------------------------------------------------

class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer

    def get_queryset(self):
        # Only return transactions belonging to the logged-in user.
        qs = Transaction.objects.filter(owner=self.request.user)

        # Optional filters from URL query parameters.
        params = self.request.query_params

        if params.get("type"):
            qs = qs.filter(type=params["type"])

        if params.get("category"):
            qs = qs.filter(category_id=params["category"])

        if params.get("date_from"):
            qs = qs.filter(
                transaction_date__gte=params["date_from"]
            )

        if params.get("date_to"):
            qs = qs.filter(
                transaction_date__lte=params["date_to"]
            )

        return qs

    def perform_create(self, serializer):
        # Assign ownership on the server, never trust the client.
        serializer.save(owner=self.request.user)


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Budget.objects.filter(
            owner=self.request.user
        ).select_related("category")

        month = self.request.query_params.get("month")
        year = self.request.query_params.get("year")
        category = self.request.query_params.get("category")

        if month:
            queryset = queryset.filter(month=month)

        if year:
            queryset = queryset.filter(year=year)

        if category:
            queryset = queryset.filter(category_id=category)

        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# --------------------------------------------------
# DASHBOARD SUMMARY API
# --------------------------------------------------


class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        current = timezone.localdate()
        month_value = request.query_params.get("month")
        year_value = request.query_params.get("year")
        if bool(month_value) != bool(year_value):
            raise ValidationError({"period": "Both month and year must be supplied together."})

        try:
            month = int(month_value) if month_value else current.month
            year = int(year_value) if year_value else current.year
            if not 1 <= month <= 12 or not 2000 <= year <= 2100:
                raise ValueError
        except (TypeError, ValueError):
            raise ValidationError({"period": "Provide a valid month and year."})

        summary = get_dashboard_summary(request.user, month=month, year=year)

        return Response(summary)
