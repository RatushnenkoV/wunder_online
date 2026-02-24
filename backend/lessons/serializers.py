from rest_framework import serializers
from .models import Lesson, LessonFolder, Slide, LessonMedia, LessonSession


class LessonFolderSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    lessons_count = serializers.SerializerMethodField()

    class Meta:
        model = LessonFolder
        fields = [
            'id', 'name', 'owner', 'owner_name',
            'parent', 'children_count', 'lessons_count',
            'created_at',
        ]
        read_only_fields = ['owner', 'created_at']

    def get_owner_name(self, obj):
        return f'{obj.owner.last_name} {obj.owner.first_name}'

    def get_children_count(self, obj):
        return obj.children.count()

    def get_lessons_count(self, obj):
        return obj.lessons.count()


class LessonSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    folder_name = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    slides_count = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'description',
            'owner', 'owner_name',
            'folder', 'folder_name',
            'is_public', 'cover_color',
            'is_owner', 'slides_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['owner', 'created_at', 'updated_at']

    def get_owner_name(self, obj):
        return f'{obj.owner.last_name} {obj.owner.first_name}'

    def get_folder_name(self, obj):
        return obj.folder.name if obj.folder else None

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return obj.owner_id == request.user.id

    def get_slides_count(self, obj):
        return obj.slides.count()


class SlideSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Slide
        fields = [
            'id', 'lesson', 'order', 'slide_type',
            'title', 'content', 'image_url',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['lesson', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class LessonSessionSerializer(serializers.ModelSerializer):
    lesson_title = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()
    school_class_name = serializers.SerializerMethodField()
    current_slide_id = serializers.SerializerMethodField()

    class Meta:
        model = LessonSession
        fields = [
            'id', 'lesson', 'lesson_title',
            'teacher', 'teacher_name',
            'school_class', 'school_class_name',
            'current_slide_id',
            'is_active', 'started_at', 'ended_at',
        ]
        read_only_fields = ['teacher', 'started_at', 'ended_at', 'is_active']

    def get_lesson_title(self, obj):
        return obj.lesson.title if obj.lesson else ''

    def get_teacher_name(self, obj):
        if not obj.teacher:
            return ''
        return f'{obj.teacher.last_name} {obj.teacher.first_name}'.strip()

    def get_school_class_name(self, obj):
        return str(obj.school_class) if obj.school_class else ''

    def get_current_slide_id(self, obj):
        return obj.current_slide_id


class LessonMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = LessonMedia
        fields = ['id', 'lesson', 'url', 'uploaded_at']
        read_only_fields = ['lesson', 'uploaded_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url
