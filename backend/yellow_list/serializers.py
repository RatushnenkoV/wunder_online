from rest_framework import serializers

from .models import YellowListEntry, YellowListComment


class YellowListCommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = YellowListComment
        fields = ['id', 'text', 'created_by_name', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.last_name} {obj.created_by.first_name}'
        return ''


class YellowListEntrySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_class = serializers.SerializerMethodField()
    student_user_id = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()
    comments = YellowListCommentSerializer(many=True, read_only=True)

    class Meta:
        model = YellowListEntry
        fields = [
            'id', 'date', 'fact', 'lesson', 'is_read_by_spps',
            'student_name', 'student_class', 'student_user_id',
            'submitted_by_name', 'created_at', 'comments',
        ]

    def get_student_name(self, obj):
        u = obj.student.user
        return f'{u.last_name} {u.first_name}'

    def get_student_class(self, obj):
        return str(obj.student.school_class) if obj.student.school_class else ''

    def get_student_user_id(self, obj):
        return obj.student.user_id

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return f'{obj.submitted_by.last_name} {obj.submitted_by.first_name}'
        return ''


class YellowListEntryListSerializer(serializers.ModelSerializer):
    """Compact serializer for list view (no comments)."""
    student_name = serializers.SerializerMethodField()
    student_class = serializers.SerializerMethodField()
    student_profile_id = serializers.IntegerField(source='student_id')
    student_user_id = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = YellowListEntry
        fields = [
            'id', 'date', 'fact', 'lesson', 'is_read_by_spps',
            'student_name', 'student_class', 'student_profile_id', 'student_user_id',
            'submitted_by_name', 'created_at', 'comments_count',
        ]

    def get_student_name(self, obj):
        u = obj.student.user
        return f'{u.last_name} {u.first_name}'

    def get_student_class(self, obj):
        return str(obj.student.school_class) if obj.student.school_class else ''

    def get_student_user_id(self, obj):
        return obj.student.user_id

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return f'{obj.submitted_by.last_name} {obj.submitted_by.first_name}'
        return ''

    def get_comments_count(self, obj):
        return obj.comments.count()


class YellowListEntryCreateSerializer(serializers.Serializer):
    date = serializers.DateField()
    student_profile_id = serializers.IntegerField()
    fact = serializers.CharField()
    lesson = serializers.CharField(required=False, allow_blank=True, default='')
