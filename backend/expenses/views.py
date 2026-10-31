
from django.db.models import Q
from rest_framework import generics, permissions, viewsets

from .models import Category, Transaction
from .serializers import (
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
