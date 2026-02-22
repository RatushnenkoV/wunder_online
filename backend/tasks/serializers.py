from rest_framework import serializers
from .models import Task, TaskFile, TaskGroup


class TaskGroupSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    members_detail = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()

    class Meta:
        model = TaskGroup
        fields = [
            'id', 'name', 'description',
            'created_by', 'created_by_name',
            'members', 'members_detail', 'is_member',
            'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.last_name} {obj.created_by.first_name}'
        return None

    def get_members_detail(self, obj):
        return [
            {'id': u.id, 'first_name': u.first_name, 'last_name': u.last_name, 'roles': u.roles}
            for u in obj.members.all()
        ]

    def get_is_member(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return obj.members.filter(id=request.user.id).exists()


class TaskFileSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = TaskFile
        fields = ['id', 'original_name', 'url', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['uploaded_by', 'uploaded_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f'{obj.uploaded_by.last_name} {obj.uploaded_by.first_name}'
        return None

    def get_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class TaskSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    assigned_group_name = serializers.SerializerMethodField()
    taken_by_name = serializers.SerializerMethodField()
    is_assignee = serializers.SerializerMethodField()
    can_reassign = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description',
            'created_by', 'created_by_name',
            'assigned_to', 'assigned_to_name',
            'assigned_group', 'assigned_group_name',
            'taken_by', 'taken_by_name',
            'status', 'due_date',
            'is_assignee', 'can_reassign',
            'files',
            'created_at', 'updated_at', 'completed_at',
        ]
        read_only_fields = ['created_by', 'status', 'taken_by', 'created_at', 'updated_at', 'completed_at']

    def get_created_by_name(self, obj):
        return f'{obj.created_by.last_name} {obj.created_by.first_name}'

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f'{obj.assigned_to.last_name} {obj.assigned_to.first_name}'
        return None

    def get_assigned_group_name(self, obj):
        return obj.assigned_group.name if obj.assigned_group else None

    def get_taken_by_name(self, obj):
        if obj.taken_by:
            return f'{obj.taken_by.last_name} {obj.taken_by.first_name}'
        return None

    def get_is_assignee(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return obj.is_assignee(request.user)

    def get_can_reassign(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return obj.can_reassign(request.user)

    def get_files(self, obj):
        return TaskFileSerializer(
            obj.files.all(), many=True, context=self.context
        ).data

    def validate(self, data):
        assigned_to = data.get('assigned_to')
        assigned_group = data.get('assigned_group')
        if not assigned_to and not assigned_group:
            raise serializers.ValidationError('Укажите исполнителя или группу')
        if assigned_to and assigned_group:
            raise serializers.ValidationError('Укажите либо исполнителя, либо группу')
        return data
