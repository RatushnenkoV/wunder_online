from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Group, GroupMessage, MessageFile, GroupTask

User = get_user_model()


class GroupMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'is_admin', 'is_teacher']


class MessageFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MessageFile
        fields = ['id', 'original_filename', 'file_url', 'file_size']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class GroupTaskSerializer(serializers.ModelSerializer):
    assignees = GroupMemberSerializer(many=True, read_only=True)
    assignee_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='assignees',
        required=False,
        queryset=User.objects.all(),
    )
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupTask
        fields = [
            'id', 'title', 'description', 'assignees', 'assignee_ids',
            'deadline', 'is_completed', 'created_by', 'created_by_name',
            'created_at', 'message',
        ]
        read_only_fields = ['created_by', 'created_at', 'message']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.last_name} {obj.created_by.first_name}'
        return ''


class GroupMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    file = MessageFileSerializer(read_only=True)
    task = GroupTaskSerializer(read_only=True)

    class Meta:
        model = GroupMessage
        fields = ['id', 'sender', 'sender_name', 'content', 'message_type', 'created_at', 'file', 'task']
        read_only_fields = ['sender', 'created_at']

    def get_sender_name(self, obj):
        if obj.sender:
            return f'{obj.sender.last_name} {obj.sender.first_name}'
        return 'Удалённый пользователь'


class GroupSerializer(serializers.ModelSerializer):
    members_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'created_by', 'members_count', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def get_members_count(self, obj):
        return obj.members.count()


class GroupDetailSerializer(serializers.ModelSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'created_by', 'created_by_name', 'members', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.last_name} {obj.created_by.first_name}'
        return ''
