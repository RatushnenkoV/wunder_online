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

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'phone',
            'is_admin', 'is_teacher', 'is_parent', 'is_student',
            'must_change_password', 'temp_password', 'roles',
        ]
        read_only_fields = ['id', 'must_change_password', 'temp_password']


class UserCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField(required=False, default='')
    phone = serializers.CharField(required=False, default='')
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=['admin', 'teacher', 'parent', 'student']),
        required=False, default=[]
    )


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users — hides temp_password if already changed."""
    roles = serializers.ReadOnlyField()
    temp_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'phone',
            'is_admin', 'is_teacher', 'is_parent', 'is_student',
            'must_change_password', 'temp_password', 'roles',
        ]

    def get_temp_password(self, obj):
        if obj.must_change_password:
            return obj.temp_password
        return ''
