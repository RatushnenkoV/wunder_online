from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from django.core.exceptions import ValidationError
from accounts.permissions import PasswordChanged
from core.validators import validate_file_mime, ALLOWED_IMAGES, ALLOWED_PDF, ALLOWED_EXCEL
from .models import ChatRoom, ChatMember, ChatMessage, MessageAttachment, ChatPoll, ChatPollOption, ChatPollVote, ChatTaskTake, StudentChatRestriction, ChatAllowedEmoji, ChatReaction

ALLOWED_CHAT_FILES = ALLOWED_IMAGES + ALLOWED_PDF + ALLOWED_EXCEL
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
    """Проверяет право доступа к комнате.
    Admins могут читать групповые чаты (модерация), но не личные переписки."""
    if room.members_rel.filter(user=user).exists():
        return True
    # Admin может видеть групповые чаты, но не личную переписку (direct)
    if user.is_admin and room.room_type == ChatRoom.TYPE_GROUP:
        return True
    return False


# ─── Rooms ────────────────────────────────────────────────────────────────────

class ChatRoomListView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request):
        room_ids = ChatMember.objects.filter(user=request.user).values_list('room_id', flat=True)
        # Prefetch только активные сообщения (не удалённые), отсортированные по убыванию.
        # to_attr='active_messages' кладёт результат в атрибут объекта — без лишних DB-запросов.
        rooms = ChatRoom.objects.filter(id__in=room_ids, is_archived=False).prefetch_related(
            'members_rel__user',
            Prefetch(
                'messages',
                queryset=ChatMessage.objects.filter(is_deleted=False).order_by('-created_at'),
                to_attr='active_messages',
            ),
        )
        # Сортируем в Python по first элементу active_messages (новейшее сообщение).
        # Комнаты без сообщений уходят в конец по дате создания.
        rooms_list = sorted(
            rooms,
            key=lambda r: r.active_messages[0].created_at if r.active_messages else r.created_at,
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
        try:
            room = ChatRoom.objects.get(pk=pk)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Чат не найден.'}, status=404)
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

        qs = room.messages.select_related('sender', 'reply_to__sender').prefetch_related('attachments', 'reactions')
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

        # Проверка ограничений для учеников
        if request.user.is_student:
            try:
                r = StudentChatRestriction.objects.get(student=request.user)
                from django.utils import timezone
                if r.muted_until and r.muted_until > timezone.now():
                    return Response({'detail': 'Вы временно лишены возможности писать.'}, status=403)
                if r.no_files:
                    return Response({'detail': 'Вам запрещено отправлять файлы.'}, status=403)
            except StudentChatRestriction.DoesNotExist:
                pass

        try:
            validate_file_mime(uploaded, ALLOWED_CHAT_FILES, label='файл чата')
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)

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

        # Проверка ограничений для учеников
        if request.user.is_student:
            try:
                r = StudentChatRestriction.objects.get(student=request.user)
                from django.utils import timezone
                if r.muted_until and r.muted_until > timezone.now():
                    return Response({'detail': 'Вы временно лишены возможности писать.'}, status=403)
                if r.no_polls:
                    return Response({'detail': 'Вам запрещено создавать опросы.'}, status=403)
            except StudentChatRestriction.DoesNotExist:
                pass

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


# ─── Student Chat Restrictions ────────────────────────────────────────────────

class StudentRestrictionView(APIView):
    """
    GET  /api/chat/restrictions/<student_id>/  — получить ограничения
    PUT  /api/chat/restrictions/<student_id>/  — установить/обновить (любой взрослый)
    """
    permission_classes = [PasswordChanged]

    def _can_manage(self, user):
        return user.is_admin or user.is_teacher or user.is_parent

    def get(self, request, student_id):
        if not self._can_manage(request.user):
            return Response({'detail': 'Нет прав.'}, status=403)
        try:
            r = StudentChatRestriction.objects.get(student_id=student_id)
        except StudentChatRestriction.DoesNotExist:
            return Response({
                'student_id': student_id,
                'message_cooldown': 0,
                'muted_until': None,
                'no_links': False,
                'no_files': False,
                'no_polls': False,
            })
        return Response({
            'student_id': r.student_id,
            'message_cooldown': r.message_cooldown,
            'muted_until': r.muted_until.isoformat() if r.muted_until else None,
            'no_links': r.no_links,
            'no_files': r.no_files,
            'no_polls': r.no_polls,
            'set_by': r.set_by_id,
            'updated_at': r.updated_at.isoformat(),
        })

    def put(self, request, student_id):
        if not self._can_manage(request.user):
            return Response({'detail': 'Нет прав.'}, status=403)
        try:
            target = User.objects.get(pk=student_id)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден.'}, status=404)
        if not target.is_student:
            return Response({'detail': 'Ограничения применимы только к ученикам.'}, status=400)

        restriction, _ = StudentChatRestriction.objects.get_or_create(
            student=target,
            defaults={'set_by': request.user},
        )
        restriction.set_by = request.user
        if 'message_cooldown' in request.data:
            restriction.message_cooldown = max(0, int(request.data['message_cooldown']))
        if 'muted_until' in request.data:
            val = request.data['muted_until']
            if val:
                from django.utils.dateparse import parse_datetime
                restriction.muted_until = parse_datetime(val)
            else:
                restriction.muted_until = None
        if 'no_links' in request.data:
            restriction.no_links = bool(request.data['no_links'])
        if 'no_files' in request.data:
            restriction.no_files = bool(request.data['no_files'])
        if 'no_polls' in request.data:
            restriction.no_polls = bool(request.data['no_polls'])
        restriction.save()

        return Response({
            'student_id': restriction.student_id,
            'message_cooldown': restriction.message_cooldown,
            'muted_until': restriction.muted_until.isoformat() if restriction.muted_until else None,
            'no_links': restriction.no_links,
            'no_files': restriction.no_files,
            'no_polls': restriction.no_polls,
            'updated_at': restriction.updated_at.isoformat(),
        })


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

        is_first_take = not ChatTaskTake.objects.filter(message=msg).exists()

        if is_first_take:
            # Первый берёт — переносим оригинальную задачу, без клонирования
            template.assigned_to = request.user
            template.taken_by = request.user
            template.status = 'in_progress'
            template.save(update_fields=['assigned_to', 'taken_by', 'status'])
            user_task = template
        else:
            # Следующие участники — создаём личную копию
            user_task = Task.objects.create(
                title=template.title,
                description=template.description,
                due_date=template.due_date,
                created_by=template.created_by,
                assigned_to=request.user,
                taken_by=request.user,
                status='in_progress',
            )
        ChatTaskTake.objects.create(message=msg, user=request.user, task=user_task)

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


# ─── Emoji reactions ──────────────────────────────────────────────────────────

class ChatAllowedEmojiView(APIView):
    """GET — список разрешённых эмодзи; PUT (admin) — установить список."""
    permission_classes = [PasswordChanged]

    def get(self, request):
        emojis = list(ChatAllowedEmoji.objects.values_list('emoji', flat=True))
        if not emojis:
            emojis = ChatAllowedEmoji.DEFAULT_EMOJIS
        return Response(emojis)

    def put(self, request):
        if not request.user.is_admin:
            return Response({'detail': 'Только администраторы.'}, status=403)
        emojis = request.data.get('emojis', [])
        ChatAllowedEmoji.objects.all().delete()
        for i, e in enumerate(emojis[:20]):
            e = str(e).strip()
            if e:
                ChatAllowedEmoji.objects.create(emoji=e, order=i)
        return Response(list(ChatAllowedEmoji.objects.values_list('emoji', flat=True)))


class ChatMessageReactView(APIView):
    """POST /chat/messages/<id>/react/ — переключить реакцию (toggle)."""
    permission_classes = [PasswordChanged]

    def post(self, request, msg_id):
        try:
            msg = ChatMessage.objects.select_related('room').get(pk=msg_id)
        except ChatMessage.DoesNotExist:
            return Response({'detail': 'Сообщение не найдено.'}, status=404)
        if not _is_room_member(msg.room, request.user):
            return Response({'detail': 'Нет доступа.'}, status=403)
        if msg.is_deleted:
            return Response({'detail': 'Сообщение удалено.'}, status=400)

        emoji = request.data.get('emoji', '').strip()
        if not emoji:
            return Response({'detail': 'Требуется emoji.'}, status=400)

        # One reaction per user per message: remove existing, then add new unless toggling same
        already_same = ChatReaction.objects.filter(message=msg, user=request.user, emoji=emoji).exists()
        ChatReaction.objects.filter(message=msg, user=request.user).delete()
        if not already_same:
            ChatReaction.objects.create(message=msg, user=request.user, emoji=emoji)

        # Aggregate reactions
        from collections import Counter
        all_reactions = list(ChatReaction.objects.filter(message=msg))
        counts = Counter(r.emoji for r in all_reactions)
        my_emojis = set(r.emoji for r in all_reactions if r.user_id == request.user.id)
        reactions = [
            {'emoji': e, 'count': c, 'user_reacted': e in my_emojis}
            for e, c in sorted(counts.items())
        ]

        broadcast(msg.room_id, {
            'type': 'chat_reaction_updated',
            'message_id': msg_id,
            'reactions': reactions,
        })
        return Response(reactions)


# ─── Bulk delete ──────────────────────────────────────────────────────────────

class ChatBulkDeleteView(APIView):
    """POST /chat/rooms/<pk>/messages/bulk-delete/ — массовое удаление."""
    permission_classes = [PasswordChanged]

    def post(self, request, pk):
        try:
            room = ChatRoom.objects.get(pk=pk)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Чат не найден.'}, status=404)
        if not _is_room_member(room, request.user):
            return Response({'detail': 'Нет доступа.'}, status=403)

        ids = request.data.get('ids', [])
        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Требуется список ids.'}, status=400)

        deleted = 0
        for msg_id in ids[:50]:
            try:
                msg = ChatMessage.objects.get(pk=msg_id, room=room, is_deleted=False)
            except ChatMessage.DoesNotExist:
                continue
            if not request.user.is_admin and msg.sender_id != request.user.id:
                continue
            msg.is_deleted = True
            msg.text = ''
            msg.save(update_fields=['is_deleted', 'text'])
            broadcast(pk, {'type': 'chat_message_deleted', 'message_id': msg_id})
            deleted += 1

        return Response({'deleted': deleted})
