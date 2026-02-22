from rest_framework import serializers
from .models import User


class LoginSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=6, write_only=True)


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.ReadOnlyField()
    curated_classes = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'phone', 'birth_date',
            'is_admin', 'is_teacher', 'is_parent', 'is_student',
            'must_change_password', 'temp_password', 'roles', 'curated_classes',
        ]
        read_only_fields = ['id', 'must_change_password', 'temp_password']

    def get_curated_classes(self, obj):
        return [str(c) for c in obj.curated_classes.all()]


class UserCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField(required=False, default='')
    phone = serializers.CharField(required=False, default='')
    birth_date = serializers.DateField(required=False, default=None, allow_null=True)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=['admin', 'teacher', 'parent', 'student']),
        required=False, default=[]
    )


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users — hides temp_password if already changed."""
    roles = serializers.ReadOnlyField()
    temp_password = serializers.SerializerMethodField()
    curated_classes = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'phone', 'birth_date',
            'is_admin', 'is_teacher', 'is_parent', 'is_student',
            'must_change_password', 'temp_password', 'roles', 'curated_classes',
        ]

    def get_temp_password(self, obj):
        if obj.must_change_password:
            return obj.temp_password
        return ''

    def get_curated_classes(self, obj):
        return [str(c) for c in obj.curated_classes.all()]


class ParentChildSerializer(serializers.Serializer):
    """Compact child info for parent serializer."""
    id = serializers.IntegerField(source='user.id')
    student_profile_id = serializers.IntegerField(source='id')
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    school_class_name = serializers.SerializerMethodField()

    def get_school_class_name(self, obj):
        return str(obj.school_class)


class ParentSerializer(serializers.ModelSerializer):
    """Full parent serializer for admin CRUD."""
    roles = serializers.ReadOnlyField()
    temp_password = serializers.SerializerMethodField()
    telegram = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    curated_classes = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'phone', 'birth_date',
            'telegram', 'must_change_password', 'temp_password',
            'roles', 'curated_classes', 'children',
        ]

    def get_temp_password(self, obj):
        if obj.must_change_password:
            return obj.temp_password
        return ''

    def get_telegram(self, obj):
        try:
            return obj.parent_profile.telegram
        except Exception:
            return ''

    def get_children(self, obj):
        try:
            children_qs = obj.parent_profile.children.select_related('user', 'school_class', 'school_class__grade_level')
            return ParentChildSerializer(children_qs, many=True).data
        except Exception:
            return []

    def get_curated_classes(self, obj):
        return [str(c) for c in obj.curated_classes.all()]
