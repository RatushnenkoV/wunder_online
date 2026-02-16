from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_teacher


class IsAdminOrTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.is_admin or request.user.is_teacher)


class PasswordChanged(BasePermission):
    message = 'Необходимо сменить пароль перед использованием системы.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and not request.user.must_change_password
