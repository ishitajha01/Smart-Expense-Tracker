from django.urls import path

from .views import ChatView, ConfirmActionView, ConversationDetailView, ConversationListView

urlpatterns = [
    path("chat/", ChatView.as_view(), name="ai-chat"),
    path("confirm-action/", ConfirmActionView.as_view(), name="ai-confirm-action"),
    path("conversations/", ConversationListView.as_view(), name="ai-conversations"),
    path("conversations/<int:conversation_id>/", ConversationDetailView.as_view(), name="ai-conversation-detail"),
]
