from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from .models import Conversation, Message
from .providers.gemini import ProviderError
from .serializers import ChatRequestSerializer, ConversationSerializer
from .services import respond
from expenses.models import Category
from expenses.serializers import TransactionSerializer, BudgetSerializer


class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = Conversation.objects.filter(owner=request.user)
        return Response(ConversationSerializer(conversations, many=True).data)

    def post(self, request):
        conversation = Conversation.objects.create(owner=request.user)
        return Response(ConversationSerializer(conversation).data, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, owner=request.user, pk=conversation_id)
        return Response(ConversationSerializer(conversation).data)

    def delete(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, owner=request.user, pk=conversation_id)
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai_chat"

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            conversation = (
                Conversation.objects.get(owner=request.user, pk=data["conversation_id"])
                if data.get("conversation_id") else Conversation(owner=request.user)
            )
        except Conversation.DoesNotExist:
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = respond(
                request.user, conversation, data["message"],
                data.get("month"), data.get("year"),
            )
        except ImproperlyConfigured:
            return Response(
                {"detail": "Sprout AI isn't configured yet. Add GEMINI_API_KEY to the backend environment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        pending_action = None
        if isinstance(result, dict) and "action" in result:
            action, args = result["action"], result["arguments"]
            if action == "propose_transaction":
                category_name = args.pop("category", None)
                category = Category.objects.filter(name__iexact=category_name).filter(
                    Q(owner=request.user) | Q(owner__isnull=True)
                ).first() if category_name else None
                pending_action = {"type": "transaction", "data": {
                    "description": args.get("description", ""), "amount": args.get("amount", ""),
                    "type": args.get("type", "expense"), "category": category.id if category else None,
                    "category_name": category_name or "",
                    "transaction_date": args.get("transaction_date", ""),
                }}
                answer = "I prepared a transaction draft. Review the details and confirm to save it."
            else:
                category_name = args.get("category", "")
                category = Category.objects.filter(name__iexact=category_name).filter(
                    Q(owner=request.user) | Q(owner__isnull=True)
                ).first()
                pending_action = {"type": "budget", "data": {
                    "category": category.id if category else None, "category_name": category_name,
                    "amount": args.get("amount", ""), "month": args.get("month"), "year": args.get("year"),
                }}
                answer = "I prepared a budget draft. Review the details and confirm to save it."
        else:
            answer = result["answer"]
        with transaction.atomic():
            if not conversation.pk:
                conversation.save()
            if conversation.messages.count() == 0:
                conversation.title = data["message"][:117] + ("…" if len(data["message"]) > 117 else "")
                conversation.save(update_fields=["title", "updated_at"])
            user_message = Message.objects.create(
                conversation=conversation, role=Message.USER, content=data["message"]
            )
            assistant_message = Message.objects.create(
                conversation=conversation, role=Message.ASSISTANT, content=answer
            )
            conversation.save(update_fields=["updated_at"])
        return Response({
            "conversation_id": conversation.id,
            "user_message": {"id": user_message.id, "role": user_message.role,
                             "content": user_message.content, "created_at": user_message.created_at},
            "message": {"id": assistant_message.id, "role": assistant_message.role,
                        "content": assistant_message.content, "created_at": assistant_message.created_at},
            "pending_action": pending_action,
        })


class ConfirmActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        action_type = request.data.get("type")
        if action_type not in ("transaction", "budget"):
            return Response({"detail": "Unsupported action."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            data = dict(request.data.get("data", {}))
            category_name = str(data.pop("category_name", "")).strip()
            if category_name and not data.get("category"):
                category = Category.objects.filter(name__iexact=category_name).filter(
                    Q(owner=request.user) | Q(owner__isnull=True)
                ).first()
                if not category:
                    category = Category.objects.create(owner=request.user, name=category_name)
                data["category"] = category.pk
            serializer_class = TransactionSerializer if action_type == "transaction" else BudgetSerializer
            serializer = serializer_class(data=data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            record = serializer.save(owner=request.user)
        return Response({"type": action_type, "record_id": record.pk, "detail": "Action confirmed and saved."}, status=status.HTTP_201_CREATED)
