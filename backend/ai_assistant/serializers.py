from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "created_at"]


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "title", "created_at", "updated_at", "messages"]


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=8000, trim_whitespace=True)
    conversation_id = serializers.IntegerField(required=False, min_value=1)
    month = serializers.IntegerField(required=False, min_value=1, max_value=12)
    year = serializers.IntegerField(required=False, min_value=2000, max_value=2100)

    def validate_message(self, value):
        if not value:
            raise serializers.ValidationError("Enter a message to continue.")
        return value

    def validate(self, attrs):
        if ("month" in attrs) != ("year" in attrs):
            raise serializers.ValidationError("Month and year must be provided together.")
        return attrs
