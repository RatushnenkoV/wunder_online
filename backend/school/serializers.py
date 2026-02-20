from rest_framework import serializers
from accounts.serializers import UserListSerializer
from .models import (
    GradeLevel, SchoolClass, Subject, GradeLevelSubject,
    StudentProfile, ParentProfile, TeacherProfile,
    ClassGroup, ClassSubject, Room, ScheduleLesson, Substitution,
)


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name']


class GradeLevelSerializer(serializers.ModelSerializer):
    subjects = serializers.SerializerMethodField()

    class Meta:
        model = GradeLevel
        fields = ['id', 'number', 'subjects']

    def get_subjects(self, obj):
        links = GradeLevelSubject.objects.filter(grade_level=obj).select_related('subject')
        return SubjectSerializer([l.subject for l in links], many=True).data


class SchoolClassSerializer(serializers.ModelSerializer):
    grade_level_number = serializers.IntegerField(source='grade_level.number', read_only=True)
    display_name = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = SchoolClass
        fields = ['id', 'grade_level', 'grade_level_number', 'letter', 'display_name', 'students_count']

    def get_display_name(self, obj):
        return str(obj)

    def get_students_count(self, obj):
        return obj.students.count()


class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserListSerializer(read_only=True)
    school_class_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = ['id', 'user', 'school_class', 'school_class_name']

    def get_school_class_name(self, obj):
        return str(obj.school_class)


class ParentProfileSerializer(serializers.ModelSerializer):
    user = UserListSerializer(read_only=True)
    children = StudentProfileSerializer(many=True, read_only=True)

    class Meta:
        model = ParentProfile
        fields = ['id', 'user', 'children']


class GradeLevelSubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    grade_level_number = serializers.IntegerField(source='grade_level.number', read_only=True)

    class Meta:
        model = GradeLevelSubject
        fields = ['id', 'grade_level', 'grade_level_number', 'subject', 'subject_name']


class ClassGroupSerializer(serializers.ModelSerializer):
    students_detail = serializers.SerializerMethodField()

    class Meta:
        model = ClassGroup
        fields = ['id', 'school_class', 'name', 'students', 'students_detail']
        read_only_fields = ['school_class']

    def get_students_detail(self, obj):
        return [
            {'id': u.id, 'first_name': u.first_name, 'last_name': u.last_name}
            for u in obj.students.order_by('last_name', 'first_name')
        ]


class ClassSubjectSerializer(serializers.ModelSerializer):
    group_name = serializers.SerializerMethodField()

    class Meta:
        model = ClassSubject
        fields = ['id', 'school_class', 'name', 'group', 'group_name']
        read_only_fields = ['school_class']

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name']


class ScheduleLessonSerializer(serializers.ModelSerializer):
    class_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    room_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleLesson
        fields = [
            'id', 'school_class', 'class_name', 'weekday', 'lesson_number',
            'subject', 'subject_name', 'teacher', 'teacher_name',
            'room', 'room_name', 'group', 'group_name',
        ]

    def get_class_name(self, obj):
        return str(obj.school_class)

    def get_teacher_name(self, obj):
        if obj.teacher:
            return f'{obj.teacher.last_name} {obj.teacher.first_name}'
        return None

    def get_room_name(self, obj):
        return obj.room.name if obj.room else None

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None


class SubstitutionSerializer(serializers.ModelSerializer):
    class_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    room_name = serializers.SerializerMethodField()
    original_subject_name = serializers.SerializerMethodField()
    original_teacher_name = serializers.SerializerMethodField()
    original_room_name = serializers.SerializerMethodField()
    original_class_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()

    class Meta:
        model = Substitution
        fields = [
            'id', 'date', 'lesson_number',
            'school_class', 'class_name',
            'subject', 'subject_name',
            'teacher', 'teacher_name',
            'room', 'room_name',
            'group', 'group_name',
            'original_lesson',
            'original_subject_name', 'original_teacher_name',
            'original_room_name', 'original_class_name',
        ]

    def get_class_name(self, obj):
        return str(obj.school_class)

    def get_teacher_name(self, obj):
        if obj.teacher:
            return f'{obj.teacher.last_name} {obj.teacher.first_name}'
        return None

    def get_room_name(self, obj):
        return obj.room.name if obj.room else None

    def get_original_subject_name(self, obj):
        if obj.original_lesson:
            return obj.original_lesson.subject.name
        return None

    def get_original_teacher_name(self, obj):
        if obj.original_lesson and obj.original_lesson.teacher:
            t = obj.original_lesson.teacher
            return f'{t.last_name} {t.first_name}'
        return None

    def get_original_room_name(self, obj):
        if obj.original_lesson and obj.original_lesson.room:
            return obj.original_lesson.room.name
        return None

    def get_original_class_name(self, obj):
        if obj.original_lesson:
            return str(obj.original_lesson.school_class)
        return None

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None
