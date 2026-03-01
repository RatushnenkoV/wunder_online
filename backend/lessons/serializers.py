from rest_framework import serializers
from .models import Lesson, LessonFolder, Slide, LessonMedia, LessonSession, Textbook, LessonAssignment


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


class TextbookSerializer(serializers.ModelSerializer):
    subject_name = serializers.SerializerMethodField()
    grade_levels_data = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Textbook
        fields = [
            'id', 'title', 'file_url', 'original_name', 'file_size',
            'subject', 'subject_name',
            'grade_levels_data',
            'uploaded_by', 'uploaded_by_name',
            'created_at',
        ]
        read_only_fields = ['uploaded_by', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file:
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def get_subject_name(self, obj):
        return obj.subject.name if obj.subject else None

    def get_grade_levels_data(self, obj):
        return [{'id': gl.id, 'number': gl.number, 'name': str(gl)} for gl in obj.grade_levels.all()]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f'{obj.uploaded_by.last_name} {obj.uploaded_by.first_name}'.strip()
        return ''


class LessonAssignmentSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    lesson_cover_color = serializers.CharField(source='lesson.cover_color', read_only=True)
    lesson_slides_count = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    school_class_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = LessonAssignment
        fields = [
            'id', 'lesson', 'lesson_title', 'lesson_cover_color', 'lesson_slides_count',
            'school_class', 'school_class_name',
            'student', 'student_name',
            'assigned_by', 'assigned_by_name',
            'due_date', 'created_at',
        ]
        read_only_fields = ['assigned_by', 'created_at']

    def get_lesson_slides_count(self, obj):
        return obj.lesson.slides.count() if obj.lesson else 0

    def get_assigned_by_name(self, obj):
        u = obj.assigned_by
        return f'{u.last_name} {u.first_name}'.strip() if u else ''

    def get_school_class_name(self, obj):
        return str(obj.school_class) if obj.school_class else None

    def get_student_name(self, obj):
        if obj.student:
            return f'{obj.student.last_name} {obj.student.first_name}'.strip()
        return None
