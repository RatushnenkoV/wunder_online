from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ChatRoom, ChatMember, ChatMessage, MessageAttachment, ChatPoll, ChatPollOption

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


class ChatPollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.SerializerMethodField()
    user_voted = serializers.SerializerMethodField()
    voters = serializers.SerializerMethodField()

    class Meta:
        model = ChatPollOption
        fields = ['id', 'text', 'order', 'vote_count', 'user_voted', 'voters']

    def get_vote_count(self, obj):
        return obj.votes.count()

    def get_user_voted(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return obj.votes.filter(user=request.user).exists()

    def get_voters(self, obj):
        return [
            {'id': v.user_id, 'name': f'{v.user.last_name} {v.user.first_name}'.strip()}
            for v in obj.votes.select_related('user').all()
        ]


class ChatPollSerializer(serializers.ModelSerializer):
    options = ChatPollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.SerializerMethodField()

    class Meta:
        model = ChatPoll
        fields = ['id', 'question', 'is_multiple', 'options', 'total_votes']

    def get_total_votes(self, obj):
        from .models import ChatPollVote
        return ChatPollVote.objects.filter(option__poll=obj).values('user').distinct().count()


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    reply_to_preview = serializers.SerializerMethodField()
    poll = serializers.SerializerMethodField()
    task_preview = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['id', 'room', 'sender', 'text', 'reply_to', 'reply_to_preview',
                  'attachments', 'poll', 'task_preview', 'created_at', 'updated_at', 'is_deleted']

    def get_reply_to_preview(self, obj):
        if not obj.reply_to_id:
            return None
        r = obj.reply_to
        if r.is_deleted:
            return {'id': r.id, 'text': '[удалено]', 'sender_name': ''}
        sender_name = f'{r.sender.last_name} {r.sender.first_name}'.strip() if r.sender else ''
        text = r.text or ('[файл]' if r.attachments.exists() else '')
        return {'id': r.id, 'text': text[:100], 'sender_name': sender_name}

    def get_poll(self, obj):
        try:
            poll = obj.poll
        except Exception:
            return None
        return ChatPollSerializer(poll, context=self.context).data

    def get_task_preview(self, obj):
        if not obj.task_id:
            return None
        task = obj.task
        created_by_name = ''
        if task.created_by:
            created_by_name = f'{task.created_by.last_name} {task.created_by.first_name}'.strip()
        takes = obj.task_takes.select_related('user').all()
        takers = [
            {'id': t.user_id, 'name': f'{t.user.last_name} {t.user.first_name}'.strip()}
            for t in takes
        ]
        request = self.context.get('request')
        user_took = bool(request and takes.filter(user=request.user).exists())
        return {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'due_date': task.due_date.isoformat() if task.due_date else None,
            'created_by_name': created_by_name,
            'takers': takers,
            'user_took': user_took,
        }


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
        # Используем prefetch-кэш active_messages если доступен (ChatRoomListView),
        # иначе fallback на DB-запрос (ChatRoomDetailView, ChatDirectView).
        active = getattr(obj, 'active_messages', None)
        msg = active[0] if active else obj.messages.filter(is_deleted=False).last()
        if not msg:
            return None
        if msg.is_deleted:
            text = '[удалено]'
        elif msg.text:
            text = msg.text
        elif msg.attachments.exists():
            text = '[файл]'
        elif msg.task_id:
            text = '[задача]'
        else:
            try:
                _ = msg.poll
                text = '[опрос]'
            except Exception:
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
        # members_rel__user prefetch-нут в ChatRoomListView — .all() использует кэш.
        member = next((m for m in obj.members_rel.all() if m.user_id == request.user.id), None)
        if not member:
            return 0
        active = getattr(obj, 'active_messages', None)
        if active is None:
            # Fallback для views без prefetch (ChatRoomDetailView и др.)
            qs = obj.messages.filter(is_deleted=False).exclude(sender=request.user)
            if member.last_read_at:
                qs = qs.filter(created_at__gt=member.last_read_at)
            return qs.count()
        # Фильтруем в Python по уже загруженным данным — 0 DB-запросов.
        return sum(
            1 for m in active
            if m.sender_id != request.user.id
            and (not member.last_read_at or m.created_at > member.last_read_at)
        )

    def get_other_user(self, obj):
        request = self.context.get('request')
        if not request or obj.room_type != ChatRoom.TYPE_DIRECT:
            return None
        # members_rel__user prefetch-нут — .all() использует кэш, не идёт в DB.
        member = next((m for m in obj.members_rel.all() if m.user_id != request.user.id), None)
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
        # .all() использует prefetch-кэш, не делает COUNT-запрос.
        return len(obj.members_rel.all())


class ChatRoomDetailSerializer(ChatRoomSerializer):
    members = ChatMemberSerializer(source='members_rel', many=True, read_only=True)

    class Meta(ChatRoomSerializer.Meta):
        fields = ChatRoomSerializer.Meta.fields + ['members']
