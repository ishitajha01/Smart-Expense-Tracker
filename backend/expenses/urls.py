
from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    BudgetViewSet,
    CategoryViewSet,
    DashboardSummaryView,
    RegisterView,
    TransactionViewSet,
)


# Automatically generate CRUD URLs for our ViewSets.
router = DefaultRouter()

router.register("categories", CategoryViewSet, basename="category")
router.register("transactions", TransactionViewSet, basename="transaction")
router.register("budgets", BudgetViewSet, basename="budget")

# Authentication, dashboard and CRUD endpoints.
urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path(
        "dashboard/summary/",
        DashboardSummaryView.as_view(),
        name="dashboard-summary",
    ),
] + router.urls
