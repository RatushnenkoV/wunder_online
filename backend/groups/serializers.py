from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ChatRoom, ChatMember, ChatMessage, MessageAttachment

User = get_user_model()


class ChatUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'display_name',
                  'is_admin', 'is_teacher', 'is_student', 'is_parent']

    def get_display_name(self, obj):
        return f'{obj.last_name} {obj.first_name}'.strip()


class MessageAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MessageAttachment
        fields = ['id', 'original_name', 'file_url', 'file_size', 'mime_type']

    def get_file_url(self, obj):
        return obj.file.url  # relative URL — proxied by Vite on all devices


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    reply_to_preview = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['id', 'room', 'sender', 'text', 'reply_to', 'reply_to_preview',
                  'attachments', 'created_at', 'updated_at', 'is_deleted']

    def get_reply_to_preview(self, obj):
        if not obj.reply_to_id:
            return None
        r = obj.reply_to
        if r.is_deleted:
            return {'id': r.id, 'text': '[удалено]', 'sender_name': ''}
        sender_name = f'{r.sender.last_name} {r.sender.first_name}'.strip() if r.sender else ''
        text = r.text or ('[файл]' if r.attachments.exists() else '')
        return {'id': r.id, 'text': text[:100], 'sender_name': sender_name}


class ChatMemberSerializer(serializers.ModelSerializer):
    user = ChatUserSerializer(read_only=True)

    class Meta:
        model = ChatMember
        fields = ['id', 'user', 'role', 'joined_at']


class ChatRoomSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_user = serializers.SerializerMethodField()
    members_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'room_type', 'name', 'created_by', 'is_archived', 'created_at',
                  'last_message', 'unread_count', 'other_user', 'members_count']

    def get_last_message(self, obj):
        msg = obj.messages.filter(is_deleted=False).last()
        if not msg:
            return None
        if msg.is_deleted:
            text = '[удалено]'
        elif msg.text:
            text = msg.text
        elif msg.attachments.exists():
            text = '[файл]'
        else:
            text = ''
        sender_name = ''
        if msg.sender:
            sender_name = f'{msg.sender.last_name} {msg.sender.first_name[0]}.' if msg.sender.first_name else msg.sender.last_name
        return {
            'id': msg.id,
            'text': text,
            'sender_id': msg.sender_id,
            'sender_name': sender_name,
            'created_at': msg.created_at.isoformat(),
        }

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        member = obj.members_rel.filter(user=request.user).first()
        qs = obj.messages.filter(is_deleted=False).exclude(sender=request.user)
        if member and member.last_read_at:
            qs = qs.filter(created_at__gt=member.last_read_at)
        return qs.count()

    def get_other_user(self, obj):
        request = self.context.get('request')
        if not request or obj.room_type != ChatRoom.TYPE_DIRECT:
            return None
        member = obj.members_rel.exclude(user=request.user).select_related('user').first()
        if not member:
            return None
        u = member.user
        return {
            'id': u.id,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'display_name': f'{u.last_name} {u.first_name}'.strip(),
            'is_admin': u.is_admin,
            'is_teacher': u.is_teacher,
            'is_student': u.is_student,
        }

    def get_members_count(self, obj):
        return obj.members_rel.count()


class ChatRoomDetailSerializer(ChatRoomSerializer):
    members = ChatMemberSerializer(source='members_rel', many=True, read_only=True)

    class Meta(ChatRoomSerializer.Meta):
        fields = ChatRoomSerializer.Meta.fields + ['members']
