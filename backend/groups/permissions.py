from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


def can_start_direct(me, them):
    """Проверяет, может ли пользователь me начать переписку с them."""
    if me.id == them.id:
        return False
    if me.is_admin:
        return True
    if me.is_teacher:
        # Учителя могут писать всем, кроме других родителей
        return them.is_teacher or them.is_admin or them.is_student
    if me.is_student:
        try:
            my_class = me.student_profile.school_class
        except Exception:
            return False
        if not my_class:
            return False
        # Учителя, ведущие уроки в этом классе
        teacher_ids = set(
            User.objects.filter(
                schedule_lessons__school_class=my_class
            ).values_list('id', flat=True).distinct()
        )
        if them.id in teacher_ids:
            return True
        # Куратор класса
        if my_class.curator_id and them.id == my_class.curator_id:
            return True
        return False
    if me.is_parent:
        # Только кураторы классов своих детей
        try:
            parent_profile = me.parent_profile
        except Exception:
            return False
        curated_class_ids = parent_profile.children.values_list(
            'school_class_id', flat=True
        ).distinct()
        from school.models import SchoolClass
        curator_ids = set(
            SchoolClass.objects.filter(
                id__in=curated_class_ids,
                curator__isnull=False,
            ).values_list('curator_id', flat=True)
        )
        return them.id in curator_ids
    return False


def get_available_dm_users(me):
    """Возвращает queryset пользователей, которым me может написать в личку."""
    if me.is_admin:
        return User.objects.exclude(id=me.id).order_by('last_name', 'first_name')

    if me.is_teacher:
        return User.objects.exclude(id=me.id).filter(
            Q(is_teacher=True) | Q(is_admin=True) | Q(is_student=True)
        ).order_by('last_name', 'first_name')

    if me.is_student:
        try:
            my_class = me.student_profile.school_class
        except Exception:
            return User.objects.none()
        if not my_class:
            return User.objects.none()
        teacher_ids = list(
            User.objects.filter(
                schedule_lessons__school_class=my_class
            ).values_list('id', flat=True).distinct()
        )
        ids = list(teacher_ids)
        if my_class.curator_id:
            ids.append(my_class.curator_id)
        return User.objects.filter(id__in=ids).exclude(id=me.id).order_by('last_name', 'first_name')

    if me.is_parent:
        try:
            parent_profile = me.parent_profile
        except Exception:
            return User.objects.none()
        curated_class_ids = parent_profile.children.values_list(
            'school_class_id', flat=True
        ).distinct()
        from school.models import SchoolClass
        curator_ids = list(
            SchoolClass.objects.filter(
                id__in=curated_class_ids,
                curator__isnull=False,
            ).values_list('curator_id', flat=True)
        )
        return User.objects.filter(id__in=curator_ids).order_by('last_name', 'first_name')

    return User.objects.none()
