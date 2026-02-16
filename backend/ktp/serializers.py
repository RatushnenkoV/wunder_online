from rest_framework import serializers
from .models import CTP, Topic, TopicFile, Holiday


class TopicFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopicFile
        fields = ['id', 'topic', 'file', 'original_name', 'uploaded_at']
        read_only_fields = ['id', 'topic', 'uploaded_at']


class TopicSerializer(serializers.ModelSerializer):
    files = TopicFileSerializer(many=True, read_only=True)

    class Meta:
        model = Topic
        fields = ['id', 'ctp', 'order', 'title', 'date', 'homework', 'resources', 'files', 'created_at']
        read_only_fields = ['id', 'ctp', 'created_at']


class TopicByDateSerializer(serializers.ModelSerializer):
    files = TopicFileSerializer(many=True, read_only=True)
    subject_name = serializers.CharField(source='ctp.subject.name', read_only=True)
    ctp_id = serializers.IntegerField(source='ctp.id', read_only=True)

    class Meta:
        model = Topic
        fields = ['id', 'title', 'date', 'homework', 'resources', 'files', 'subject_name', 'ctp_id']


class TopicCreateSerializer(serializers.Serializer):
    title = serializers.CharField()


class TopicBulkCreateSerializer(serializers.Serializer):
    titles = serializers.ListField(child=serializers.CharField())


class CTPListSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    topics_count = serializers.SerializerMethodField()

    class Meta:
        model = CTP
        fields = [
            'id', 'teacher', 'teacher_name', 'school_class', 'class_name',
            'subject', 'subject_name', 'is_public', 'topics_count',
            'created_at', 'updated_at',
        ]

    def get_teacher_name(self, obj):
        return str(obj.teacher)

    def get_class_name(self, obj):
        return str(obj.school_class)

    def get_topics_count(self, obj):
        return obj.topics.count()


class CTPDetailSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    topics = TopicSerializer(many=True, read_only=True)

    class Meta:
        model = CTP
        fields = [
            'id', 'teacher', 'teacher_name', 'school_class', 'class_name',
            'subject', 'subject_name', 'is_public', 'topics',
            'created_at', 'updated_at',
        ]

    def get_teacher_name(self, obj):
        return str(obj.teacher)

    def get_class_name(self, obj):
        return str(obj.school_class)


class CTPCreateSerializer(serializers.Serializer):
    school_class = serializers.IntegerField()
    subject = serializers.IntegerField()
    is_public = serializers.BooleanField(default=True)


class AutofillDatesSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    weekdays = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6))
    lessons_per_day = serializers.IntegerField(min_value=1, default=1)
    start_from_topic_id = serializers.IntegerField(required=False, allow_null=True)


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'date', 'description']
