from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Project, ProjectMember, ProjectPost, PostAttachment,
    ProjectAssignment, AssignmentAttachment, AssignmentSubmission, SubmissionFile,
)

User = get_user_model()


class ProjectUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'display_name',
                  'is_admin', 'is_teacher', 'is_student']

    def get_display_name(self, obj):
        return f'{obj.last_name} {obj.first_name}'.strip()


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = ProjectUserSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'role', 'joined_at']


class PostAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PostAttachment
        fields = ['id', 'original_name', 'file_url', 'file_size', 'mime_type']

    def get_file_url(self, obj):
        return obj.file.url


class ProjectPostSerializer(serializers.ModelSerializer):
    author = ProjectUserSerializer(read_only=True)
    attachments = PostAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectPost
        fields = ['id', 'project', 'author', 'text', 'attachments',
                  'is_deleted', 'created_at', 'updated_at']


class AssignmentAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentAttachment
        fields = ['id', 'original_name', 'file_url', 'file_size', 'mime_type']

    def get_file_url(self, obj):
        return obj.file.url


class SubmissionFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionFile
        fields = ['id', 'original_name', 'file_url', 'file_size', 'mime_type']

    def get_file_url(self, obj):
        return obj.file.url


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    student = ProjectUserSerializer(read_only=True)
    graded_by = ProjectUserSerializer(read_only=True)
    files = SubmissionFileSerializer(many=True, read_only=True)
    task_id = serializers.SerializerMethodField()
    task_status = serializers.SerializerMethodField()
    review_comment = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentSubmission
        fields = ['id', 'assignment', 'student', 'text', 'files',
                  'submitted_at', 'grade', 'graded_by', 'graded_at',
                  'task_id', 'task_status', 'review_comment']

    def get_task_id(self, obj):
        return obj.task_id

    def get_task_status(self, obj):
        return obj.task.status if obj.task else None

    def get_review_comment(self, obj):
        return obj.task.review_comment if obj.task else ''


class ProjectAssignmentSerializer(serializers.ModelSerializer):
    created_by = ProjectUserSerializer(read_only=True)
    attachments = AssignmentAttachmentSerializer(many=True, read_only=True)
    submissions_count = serializers.SerializerMethodField()
    my_submission = serializers.SerializerMethodField()
    lesson_title = serializers.CharField(source='lesson.title', read_only=True, default=None)

    class Meta:
        model = ProjectAssignment
        fields = ['id', 'project', 'title', 'description', 'due_date', 'lesson', 'lesson_title',
                  'created_by', 'attachments', 'submissions_count', 'my_submission',
                  'created_at', 'updated_at']

    def get_submissions_count(self, obj):
        return obj.submissions.count()

    def get_my_submission(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_student:
            return None
        sub = obj.submissions.filter(student=request.user).first()
        if not sub:
            return None
        return AssignmentSubmissionSerializer(sub, context=self.context).data


class ProjectSerializer(serializers.ModelSerializer):
    created_by = ProjectUserSerializer(read_only=True)
    members_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'cover_color', 'created_by',
                  'members_count', 'my_role', 'created_at', 'updated_at']

    def get_members_count(self, obj):
        return obj.members_rel.count()

    def get_my_role(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        member = obj.members_rel.filter(user=request.user).first()
        return member.role if member else None


class ProjectDetailSerializer(ProjectSerializer):
    members = ProjectMemberSerializer(source='members_rel', many=True, read_only=True)

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + ['members']
