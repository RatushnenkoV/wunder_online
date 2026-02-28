from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import PasswordChanged
from .models import ChatRoom, ChatMember, ChatMessage, MessageAttachment, ChatPoll, ChatPollOption, ChatPollVote, ChatTaskTake
from .permissions import can_start_direct, get_available_dm_users
from .serializers import (
    ChatRoomSerializer, ChatRoomDetailSerializer,
    ChatMessageSerializer, ChatMemberSerializer, ChatUserSerializer,
    ChatPollSerializer,
)

User = get_user_model()


def broadcast(room_id, event):
    """Отправить событие всем WebSocket-клиентам комнаты."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(f'chat_{room_id}', event)


def _is_room_member(room, user):
    return user.is_admin or room.members_rel.filter(user=user).exists()


# ─── Rooms ────────────────────────────────────────────────────────────────────

class ChatRoomListView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request):
        if request.user.is_admin:
            rooms = ChatRoom.objects.filter(is_archived=False)
        else:
            room_ids = ChatMember.objects.filter(user=request.user).values_list('room_id', flat=True)
            rooms = ChatRoom.objects.filter(id__in=room_ids, is_archived=False)

        # Сортируем: комнаты с сообщениями — по последнему сообщению, без сообщений — в конец
        rooms = rooms.prefetch_related('messages', 'members_rel__user')
        rooms_list = sorted(
            rooms,
            key=lambda r: r.messages.filter(is_deleted=False).last().created_at
            if r.messages.filter(is_deleted=False).exists() else r.created_at,
            reverse=True,
        )
        serializer = ChatRoomSerializer(rooms_list, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        # Только admin может создавать групповые чаты
        if not request.user.is_admin:
            return Response({'detail': 'Только администраторы могут создавать группы.'}, status=403)

        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Название обязательно.'}, status=400)

        room = ChatRoom.objects.create(
            room_type=ChatRoom.TYPE_GROUP,
            name=name,
            created_by=request.user,
        )
        ChatMember.objects.create(room=room, user=request.user, role=ChatMember.ROLE_ADMIN)

        # Добавить участников из запроса
        member_ids = request.data.get('member_ids', [])
        for uid in member_ids:
            try:
                u = User.objects.get(pk=uid)
                if u.id != request.user.id:
                    ChatMember.objects.get_or_create(room=room, user=u)
            except User.DoesNotExist:
                pass

        serializer = ChatRoomDetailSerializer(room, context={'request': request})
        return Response(serializer.data, status=201)


class ChatRoomDetailView(APIView):
    permission_classes = [PasswordChanged]

    def _get_room(self, pk, user):
        try:
            room = ChatRoom.objects.get(pk=pk)
        except ChatRoom.DoesNotExist:
            return None, Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, user):
            return None, Response({'detail': 'Нет доступа.'}, status=403)
        return room, None

    def get(self, request, pk):
        room, err = self._get_room(pk, request.user)
        if err:
            return err
        return Response(ChatRoomDetailSerializer(room, context={'request': request}).data)

    def patch(self, request, pk):
        room, err = self._get_room(pk, request.user)
        if err:
            return err
        # Только admin системы или admin чата
        is_room_admin = room.members_rel.filter(user=request.user, role=ChatMember.ROLE_ADMIN).exists()
        if not request.user.is_admin and not is_room_admin:
            return Response({'detail': 'Нет прав.'}, status=403)
        if 'name' in request.data:
            room.name = request.data['name'].strip()
        room.save()
        return Response(ChatRoomDetailSerializer(room, context={'request': request}).data)

    def delete(self, request, pk):
        if not request.user.is_admin:
            return Response({'detail': 'Только администраторы могут удалять чаты.'}, status=403)
        room, err = self._get_room(pk, request.user)
        if err:
            return err
        room.delete()
        return Response(status=204)


# ─── Members ──────────────────────────────────────────────────────────────────

class ChatMembersView(APIView):
    permission_classes = [PasswordChanged]

    def _get_room(self, pk, user):
        try:
            room = ChatRoom.objects.get(pk=pk)
        except ChatRoom.DoesNotExist:
            return None, Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, user):
            return None, Response({'detail': 'Нет доступа.'}, status=403)
        return room, None

    def get(self, request, pk):
        room, err = self._get_room(pk, request.user)
        if err:
            return err
        members = room.members_rel.select_related('user').order_by('joined_at')
        return Response(ChatMemberSerializer(members, many=True).data)

    def post(self, request, pk):
        """Добавить участника. Admin — кого угодно. Teacher — только себя."""
        room, err = self._get_room(pk, request.user)
        if err:
            return err
        if room.room_type == ChatRoom.TYPE_DIRECT:
            return Response({'detail': 'Нельзя добавлять участников в личный чат.'}, status=400)

        if request.user.is_admin:
            user_id = request.data.get('user_id')
            if not user_id:
                return Response({'detail': 'Требуется user_id.'}, status=400)
            try:
                user = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return Response({'detail': 'Пользователь не найден.'}, status=404)
        elif request.user.is_teacher:
            # Учитель может добавить только себя
            user = request.user
        else:
            return Response({'detail': 'Нет прав добавлять участников.'}, status=403)

        ChatMember.objects.get_or_create(room=room, user=user)
        return Response(ChatRoomDetailSerializer(room, context={'request': request}).data)

    def delete(self, request, pk, user_pk=None):
        """Удалить участника. Admin — кого угодно. Остальные — только себя."""
        room, err = self._get_room(pk, request.user)
        if err:
            return err
        if room.room_type == ChatRoom.TYPE_DIRECT:
            return Response({'detail': 'Нельзя удалять участников из личного чата.'}, status=400)

        target_id = user_pk or request.user.id
        if not request.user.is_admin and target_id != request.user.id:
            return Response({'detail': 'Нет прав.'}, status=403)

        ChatMember.objects.filter(room=room, user_id=target_id).delete()
        return Response(status=204)


# ─── Messages ─────────────────────────────────────────────────────────────────

class ChatMessagesView(APIView):
    permission_classes = [PasswordChanged]

    def _get_room(self, pk, user):
        try:
            room = ChatRoom.objects.get(pk=pk)
        except ChatRoom.DoesNotExist:
            return None, Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, user):
            return None, Response({'detail': 'Нет доступа.'}, status=403)
        return room, None

    def get(self, request, pk):
        room, err = self._get_room(pk, request.user)
        if err:
            return err

        qs = room.messages.select_related('sender', 'reply_to__sender').prefetch_related('attachments')
        before_id = request.query_params.get('before')
        if before_id:
            qs = qs.filter(id__lt=before_id)

        limit = min(int(request.query_params.get('limit', 50)), 100)
        messages = list(qs.order_by('-created_at')[:limit])
        messages.reverse()

        serializer = ChatMessageSerializer(messages, many=True, context={'request': request})
        return Response({
            'results': serializer.data,
            'has_more': qs.filter(id__lt=messages[0].id).exists() if messages else False,
        })

    def delete(self, request, pk, msg_id):
        room, err = self._get_room(pk, request.user)
        if err:
            return err
        try:
            msg = ChatMessage.objects.get(pk=msg_id, room=room)
        except ChatMessage.DoesNotExist:
            return Response({'detail': 'Сообщение не найдено.'}, status=404)

        if not request.user.is_admin and msg.sender_id != request.user.id:
            return Response({'detail': 'Нет прав.'}, status=403)

        msg.is_deleted = True
        msg.text = ''
        msg.save(update_fields=['is_deleted', 'text'])

        broadcast(pk, {'type': 'chat_message_deleted', 'message_id': msg_id})
        return Response(status=204)


# ─── File upload ──────────────────────────────────────────────────────────────

class ChatFileUploadView(APIView):
    permission_classes = [PasswordChanged]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            room = ChatRoom.objects.get(pk=pk)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, request.user):
            return Response({'detail': 'Нет доступа.'}, status=403)

        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'Файл не прикреплён.'}, status=400)

        msg = ChatMessage.objects.create(room=room, sender=request.user, text='')
        MessageAttachment.objects.create(
            message=msg,
            file=uploaded,
            original_name=uploaded.name,
            file_size=uploaded.size,
            mime_type=uploaded.content_type or '',
        )
        msg.refresh_from_db()
        serialized = ChatMessageSerializer(msg, context={'request': request}).data
        broadcast(pk, {'type': 'chat_message_new', 'message': serialized})
        return Response(serialized, status=201)


# ─── Mark read ────────────────────────────────────────────────────────────────

class ChatReadView(APIView):
    permission_classes = [PasswordChanged]

    def post(self, request, pk):
        from django.utils import timezone
        updated = ChatMember.objects.filter(
            room_id=pk, user=request.user,
        ).update(last_read_at=timezone.now())
        if not updated:
            return Response({'detail': 'Вы не участник этого чата.'}, status=403)
        return Response({'ok': True})


# ─── Available DM users ───────────────────────────────────────────────────────

class ChatUsersView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        users = get_available_dm_users(request.user)
        if q:
            from django.db.models import Q as DQ
            users = users.filter(
                DQ(first_name__icontains=q) | DQ(last_name__icontains=q)
            )
        serializer = ChatUserSerializer(users[:50], many=True)
        return Response(serializer.data)


# ─── Open / find Direct chat ──────────────────────────────────────────────────

class ChatDirectView(APIView):
    permission_classes = [PasswordChanged]

    def post(self, request):
        other_id = request.data.get('user_id')
        if not other_id:
            return Response({'detail': 'Требуется user_id.'}, status=400)
        try:
            other = User.objects.get(pk=other_id)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден.'}, status=404)

        if not can_start_direct(request.user, other):
            return Response({'detail': 'Вам нельзя писать этому пользователю.'}, status=403)

        # Найти существующий DM
        my_rooms = ChatMember.objects.filter(user=request.user).values_list('room_id', flat=True)
        other_rooms = ChatMember.objects.filter(user=other).values_list('room_id', flat=True)
        common = ChatRoom.objects.filter(
            id__in=set(my_rooms) & set(other_rooms),
            room_type=ChatRoom.TYPE_DIRECT,
        ).first()

        if common:
            return Response(ChatRoomSerializer(common, context={'request': request}).data)

        # Создать новый DM
        room = ChatRoom.objects.create(room_type=ChatRoom.TYPE_DIRECT, created_by=request.user)
        ChatMember.objects.create(room=room, user=request.user)
        ChatMember.objects.create(room=room, user=other)

        return Response(ChatRoomSerializer(room, context={'request': request}).data, status=201)


# ─── Poll ──────────────────────────────────────────────────────────────────────

class ChatPollCreateView(APIView):
    permission_classes = [PasswordChanged]

    def post(self, request, room_id):
        try:
            room = ChatRoom.objects.get(pk=room_id)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, request.user):
            return Response({'detail': 'Нет доступа.'}, status=403)

        question = request.data.get('question', '').strip()
        options_data = request.data.get('options', [])
        is_multiple = bool(request.data.get('is_multiple', False))

        if not question:
            return Response({'detail': 'Вопрос обязателен.'}, status=400)
        if len(options_data) < 2:
            return Response({'detail': 'Нужно минимум 2 варианта.'}, status=400)

        msg = ChatMessage.objects.create(room=room, sender=request.user, text='')
        poll = ChatPoll.objects.create(message=msg, question=question, is_multiple=is_multiple)
        for i, text in enumerate(options_data[:10]):
            text = str(text).strip()
            if text:
                ChatPollOption.objects.create(poll=poll, text=text, order=i)

        msg.refresh_from_db()
        serialized = ChatMessageSerializer(msg, context={'request': request}).data
        broadcast(room_id, {'type': 'chat_message_new', 'message': serialized})
        return Response(serialized, status=201)


class ChatPollVoteView(APIView):
    permission_classes = [PasswordChanged]

    def post(self, request, poll_id):
        try:
            poll = ChatPoll.objects.get(pk=poll_id)
        except ChatPoll.DoesNotExist:
            return Response({'detail': 'Опрос не найден.'}, status=404)

        room = poll.message.room
        if not _is_room_member(room, request.user):
            return Response({'detail': 'Нет доступа.'}, status=403)

        option_id = request.data.get('option_id')
        if not option_id:
            return Response({'detail': 'Требуется option_id.'}, status=400)

        try:
            option = ChatPollOption.objects.get(pk=option_id, poll=poll)
        except ChatPollOption.DoesNotExist:
            return Response({'detail': 'Вариант не найден.'}, status=404)

        if not poll.is_multiple:
            # Удалить старые голоса в этом опросе
            ChatPollVote.objects.filter(option__poll=poll, user=request.user).delete()

        ChatPollVote.objects.get_or_create(option=option, user=request.user)

        # Broadcast обновление опроса
        poll_data = ChatPollSerializer(poll, context={'request': request}).data
        broadcast(room.id, {
            'type': 'chat_poll_updated',
            'poll_id': poll.id,
            'options': poll_data['options'],
            'total_votes': poll_data['total_votes'],
        })
        return Response(poll_data)


# ─── Chat Tasks ────────────────────────────────────────────────────────────────

class ChatTaskCreateView(APIView):
    permission_classes = [PasswordChanged]

    def post(self, request, room_id):
        if not (request.user.is_admin or request.user.is_teacher):
            return Response({'detail': 'Только преподаватели могут создавать задачи в чате.'}, status=403)

        try:
            room = ChatRoom.objects.get(pk=room_id)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, request.user):
            return Response({'detail': 'Нет доступа.'}, status=403)

        from tasks.models import Task
        title = request.data.get('title', '').strip()
        if not title:
            return Response({'detail': 'Название задачи обязательно.'}, status=400)

        description = request.data.get('description', '').strip()
        due_date = request.data.get('due_date') or None

        task = Task.objects.create(
            title=title,
            description=description,
            due_date=due_date,
            created_by=request.user,
            status='new',
        )
        msg = ChatMessage.objects.create(room=room, sender=request.user, text='', task=task)
        msg.refresh_from_db()
        serialized = ChatMessageSerializer(msg, context={'request': request}).data
        broadcast(room_id, {'type': 'chat_message_new', 'message': serialized})
        return Response(serialized, status=201)


class ChatTaskTakeView(APIView):
    permission_classes = [PasswordChanged]

    def post(self, request, room_id, task_id):
        try:
            room = ChatRoom.objects.get(pk=room_id)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, request.user):
            return Response({'detail': 'Нет доступа.'}, status=403)

        # Найти сообщение с этой шаблонной задачей
        try:
            msg = ChatMessage.objects.get(task_id=task_id, room=room)
        except ChatMessage.DoesNotExist:
            return Response({'detail': 'Задача не найдена в этом чате.'}, status=404)

        # Проверить — не брал ли уже
        if ChatTaskTake.objects.filter(message=msg, user=request.user).exists():
            return Response({'detail': 'Вы уже взяли эту задачу.'}, status=400)

        from tasks.models import Task
        template = msg.task

        # Создать личную копию задачи для этого пользователя
        task_copy = Task.objects.create(
            title=template.title,
            description=template.description,
            due_date=template.due_date,
            created_by=template.created_by,
            assigned_to=request.user,
            taken_by=request.user,
            status='in_progress',
        )
        ChatTaskTake.objects.create(message=msg, user=request.user, task=task_copy)

        # Актуальный список взявших
        takers = [
            {'id': t.user_id, 'name': f'{t.user.last_name} {t.user.first_name}'.strip()}
            for t in msg.task_takes.select_related('user').all()
        ]
        broadcast(room_id, {
            'type': 'chat_task_taken',
            'task_id': task_id,
            'takers': takers,
        })
        return Response({'ok': True, 'takers': takers})
