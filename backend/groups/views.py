from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrTeacher, IsAdmin, PasswordChanged
from .models import Group, GroupMessage, MessageFile, GroupTask
from .serializers import (
    GroupSerializer, GroupDetailSerializer,
    GroupMessageSerializer, GroupTaskSerializer, GroupMemberSerializer,
)

User = get_user_model()


def broadcast_message(group_id, message_data):
    """Отправить сообщение всем WebSocket-клиентам в группе."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'chat_{group_id}',
        {
            'type': 'chat_message',
            'message': message_data,
        }
    )


class GroupListView(APIView):
    permission_classes = [IsAdminOrTeacher, PasswordChanged]

    def get(self, request):
        if request.user.is_admin:
            groups = Group.objects.all()
        else:
            groups = request.user.group_memberships.all()
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not request.user.is_admin:
            return Response({'detail': 'Только администраторы могут создавать группы.'}, status=403)
        serializer = GroupSerializer(data=request.data)
        if serializer.is_valid():
            group = serializer.save(created_by=request.user)
            # Добавить создателя в группу
            group.members.add(request.user)
            return Response(GroupDetailSerializer(group, context={'request': request}).data, status=201)
        return Response(serializer.errors, status=400)


class GroupDetailView(APIView):
    permission_classes = [IsAdminOrTeacher, PasswordChanged]

    def get_group(self, pk, user):
        try:
            group = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return None, Response({'detail': 'Группа не найдена.'}, status=404)
        if not user.is_admin and not group.members.filter(id=user.id).exists():
            return None, Response({'detail': 'Нет доступа.'}, status=403)
        return group, None

    def get(self, request, pk):
        group, err = self.get_group(pk, request.user)
        if err:
            return err
        serializer = GroupDetailSerializer(group, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        if not request.user.is_admin:
            return Response({'detail': 'Только администраторы могут редактировать группы.'}, status=403)
        group, err = self.get_group(pk, request.user)
        if err:
            return err
        serializer = GroupSerializer(group, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(GroupDetailSerializer(group, context={'request': request}).data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        if not request.user.is_admin:
            return Response({'detail': 'Только администраторы могут удалять группы.'}, status=403)
        group, err = self.get_group(pk, request.user)
        if err:
            return err
        group.delete()
        return Response(status=204)


class GroupMembersView(APIView):
    permission_classes = [IsAdmin, PasswordChanged]

    def get_group(self, pk):
        try:
            return Group.objects.get(pk=pk), None
        except Group.DoesNotExist:
            return None, Response({'detail': 'Группа не найдена.'}, status=404)

    def post(self, request, pk):
        group, err = self.get_group(pk)
        if err:
            return err
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'Требуется user_id.'}, status=400)
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден.'}, status=404)
        if not (user.is_teacher or user.is_admin):
            return Response({'detail': 'Добавлять можно только учителей и администраторов.'}, status=400)
        group.members.add(user)
        return Response(GroupDetailSerializer(group, context={'request': request}).data)

    def delete(self, request, pk, user_pk):
        group, err = self.get_group(pk)
        if err:
            return err
        try:
            user = User.objects.get(pk=user_pk)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден.'}, status=404)
        group.members.remove(user)
        return Response(GroupDetailSerializer(group, context={'request': request}).data)


class GroupMessagesView(APIView):
    permission_classes = [IsAdminOrTeacher, PasswordChanged]

    def get_group(self, pk, user):
        try:
            group = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return None, Response({'detail': 'Группа не найдена.'}, status=404)
        if not user.is_admin and not group.members.filter(id=user.id).exists():
            return None, Response({'detail': 'Нет доступа.'}, status=403)
        return group, None

    def get(self, request, pk):
        group, err = self.get_group(pk, request.user)
        if err:
            return err
        messages = group.messages.select_related('sender', 'file', 'task').prefetch_related('task__assignees').order_by('created_at')
        serializer = GroupMessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)


class GroupFileUploadView(APIView):
    permission_classes = [IsAdminOrTeacher, PasswordChanged]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            group = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return Response({'detail': 'Группа не найдена.'}, status=404)
        if not request.user.is_admin and not group.members.filter(id=request.user.id).exists():
            return Response({'detail': 'Нет доступа.'}, status=403)

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'Файл не прикреплён.'}, status=400)

        message = GroupMessage.objects.create(
            group=group,
            sender=request.user,
            content='',
            message_type=GroupMessage.TYPE_FILE,
        )
        MessageFile.objects.create(
            message=message,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
        )

        # Перезагрузить с file
        message.refresh_from_db()
        serializer = GroupMessageSerializer(message, context={'request': request})
        broadcast_message(pk, serializer.data)
        return Response(serializer.data, status=201)


class GroupTaskCreateView(APIView):
    permission_classes = [IsAdminOrTeacher, PasswordChanged]

    def post(self, request, pk):
        try:
            group = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return Response({'detail': 'Группа не найдена.'}, status=404)
        if not request.user.is_admin and not group.members.filter(id=request.user.id).exists():
            return Response({'detail': 'Нет доступа.'}, status=403)

        title = request.data.get('title', '').strip()
        if not title:
            return Response({'detail': 'Название задачи обязательно.'}, status=400)

        message = GroupMessage.objects.create(
            group=group,
            sender=request.user,
            content='',
            message_type=GroupMessage.TYPE_TASK,
        )
        task = GroupTask.objects.create(
            message=message,
            group=group,
            title=title,
            description=request.data.get('description', ''),
            deadline=request.data.get('deadline') or None,
            created_by=request.user,
        )
        assignee_ids = request.data.get('assignee_ids', [])
        if assignee_ids:
            task.assignees.set(User.objects.filter(id__in=assignee_ids))

        message.refresh_from_db()
        serializer = GroupMessageSerializer(message, context={'request': request})
        broadcast_message(pk, serializer.data)
        return Response(serializer.data, status=201)


class GroupTaskUpdateView(APIView):
    permission_classes = [IsAdminOrTeacher, PasswordChanged]

    def patch(self, request, pk, task_pk):
        try:
            group = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return Response({'detail': 'Группа не найдена.'}, status=404)
        if not request.user.is_admin and not group.members.filter(id=request.user.id).exists():
            return Response({'detail': 'Нет доступа.'}, status=403)

        try:
            task = GroupTask.objects.get(pk=task_pk, group=group)
        except GroupTask.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=404)

        if 'is_completed' in request.data:
            task.is_completed = request.data['is_completed']
        if 'title' in request.data:
            task.title = request.data['title']
        if 'description' in request.data:
            task.description = request.data['description']
        if 'deadline' in request.data:
            task.deadline = request.data['deadline'] or None
        if 'assignee_ids' in request.data:
            task.assignees.set(User.objects.filter(id__in=request.data['assignee_ids']))
        task.save()

        message = task.message
        serializer = GroupMessageSerializer(message, context={'request': request})
        broadcast_message(pk, serializer.data)
        return Response(serializer.data)
