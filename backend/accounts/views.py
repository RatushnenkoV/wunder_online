from django.contrib.auth import authenticate
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from school.models import StudentProfile, SchoolClass
from .models import User
from .permissions import IsAdmin, PasswordChanged
from .serializers import (
    LoginSerializer, ChangePasswordSerializer,
    UserCreateSerializer, UserListSerializer, UserSerializer,
)
from .services import create_user_with_temp_password, reset_user_password, import_users


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        request,
        first_name=serializer.validated_data['first_name'],
        last_name=serializer.validated_data['last_name'],
        password=serializer.validated_data['password'],
    )
    if not user:
        return Response({'detail': 'Неверные имя, фамилия или пароль'}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = request.user
    user.set_password(serializer.validated_data['new_password'])
    user.must_change_password = False
    user.temp_password = ''
    user.save()

    refresh = RefreshToken.for_user(user)
    return Response({
        'detail': 'Пароль успешно изменён',
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == 'GET':
        return Response(UserSerializer(request.user).data)

    user = request.user
    if 'phone' in request.data:
        user.phone = request.data['phone'].strip()
        user.save(update_fields=['phone'])
    return Response(UserSerializer(user).data)


def _paginate(queryset, request):
    """Apply pagination to queryset."""
    try:
        page = int(request.query_params.get('page', 1))
        per_page = int(request.query_params.get('per_page', 25))
    except (ValueError, TypeError):
        page, per_page = 1, 25
    per_page = min(per_page, 100)
    total = queryset.count()
    start = (page - 1) * per_page
    items = queryset[start:start + per_page]
    return items, {'page': page, 'per_page': per_page, 'total': total, 'pages': (total + per_page - 1) // per_page if per_page else 1}


def _apply_user_filters(queryset, request):
    """Apply search, filter, sort to user queryset."""
    search = request.query_params.get('search', '').strip()
    if search:
        queryset = queryset.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(email__icontains=search) |
            Q(phone__icontains=search)
        )

    first_name = request.query_params.get('first_name', '').strip()
    if first_name:
        queryset = queryset.filter(first_name__icontains=first_name)

    last_name = request.query_params.get('last_name', '').strip()
    if last_name:
        queryset = queryset.filter(last_name__icontains=last_name)

    email = request.query_params.get('email', '').strip()
    if email:
        queryset = queryset.filter(email__icontains=email)

    phone = request.query_params.get('phone', '').strip()
    if phone:
        queryset = queryset.filter(phone__icontains=phone)

    sort = request.query_params.get('sort', 'last_name')
    direction = request.query_params.get('direction', 'asc')
    allowed_sorts = {'last_name', 'first_name'}
    if sort in allowed_sorts:
        order = sort if direction == 'asc' else f'-{sort}'
        queryset = queryset.order_by(order)
    else:
        queryset = queryset.order_by('last_name', 'first_name')

    return queryset


# --- Staff (сотрудники: admins, teachers, parents) ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def staff_list_create(request):
    if request.method == 'GET':
        users = User.objects.filter(is_student=False)
        users = _apply_user_filters(users, request)

        role = request.query_params.get('role')
        if role:
            filter_map = {
                'admin': {'is_admin': True},
                'teacher': {'is_teacher': True},
                'parent': {'is_parent': True},
            }
            if role in filter_map:
                users = users.filter(**filter_map[role])

        items, pagination = _paginate(users, request)
        return Response({
            'results': UserListSerializer(items, many=True).data,
            'pagination': pagination,
        })

    # Batch create
    entries = request.data if isinstance(request.data, list) else [request.data]
    created = []
    errors = []
    warnings = []
    for i, entry in enumerate(entries):
        try:
            first_name = entry.get('first_name', '').strip()
            last_name = entry.get('last_name', '').strip()
            if not first_name or not last_name:
                errors.append(f'Запись {i+1}: имя и фамилия обязательны')
                continue
            roles = entry.get('roles', ['teacher'])
            if 'student' in roles:
                errors.append(f'Запись {i+1}: нельзя создать ученика как сотрудника')
                continue
            # Check for namesakes
            existing = User.objects.filter(first_name__iexact=first_name, last_name__iexact=last_name).count()
            if existing > 0:
                warnings.append(f'{last_name} {first_name}: тёзка уже есть в системе ({existing} чел.)')
            user = create_user_with_temp_password(
                first_name, last_name, roles,
                entry.get('email', ''), entry.get('phone', ''),
            )
            created.append(user)
        except Exception as e:
            errors.append(f'Запись {i+1}: {str(e)}')

    return Response({
        'created': UserListSerializer(created, many=True).data,
        'errors': errors,
        'warnings': warnings,
    }, status=status.HTTP_201_CREATED)


# --- Students (ученики) ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def student_list_create(request):
    if request.method == 'GET':
        users = User.objects.filter(is_student=True)
        users = _apply_user_filters(users, request)

        class_id = request.query_params.get('school_class')
        if class_id:
            users = users.filter(student_profile__school_class_id=class_id)

        sort = request.query_params.get('sort', '')
        if sort == 'school_class':
            direction = request.query_params.get('direction', 'asc')
            order = 'student_profile__school_class__grade_level__number' if direction == 'asc' else '-student_profile__school_class__grade_level__number'
            users = users.order_by(order, 'student_profile__school_class__letter', 'last_name')

        items, pagination = _paginate(users, request)
        data = UserListSerializer(items, many=True).data
        # Enrich with class info
        for item in data:
            try:
                sp = StudentProfile.objects.get(user_id=item['id'])
                item['school_class_id'] = sp.school_class_id
                item['school_class_name'] = str(sp.school_class)
            except StudentProfile.DoesNotExist:
                item['school_class_id'] = None
                item['school_class_name'] = ''

        return Response({
            'results': data,
            'pagination': pagination,
        })

    # Batch create students
    entries = request.data if isinstance(request.data, list) else [request.data]
    created = []
    errors = []
    warnings = []
    for i, entry in enumerate(entries):
        try:
            first_name = entry.get('first_name', '').strip()
            last_name = entry.get('last_name', '').strip()
            if not first_name or not last_name:
                errors.append(f'Запись {i+1}: имя и фамилия обязательны')
                continue
            # Check for namesakes
            existing = User.objects.filter(first_name__iexact=first_name, last_name__iexact=last_name).count()
            if existing > 0:
                warnings.append(f'{last_name} {first_name}: тёзка уже есть в системе ({existing} чел.)')
            class_id = entry.get('school_class')
            user = create_user_with_temp_password(
                first_name, last_name, ['student'],
                entry.get('email', ''), entry.get('phone', ''),
            )
            if class_id:
                try:
                    sc = SchoolClass.objects.get(pk=class_id)
                    StudentProfile.objects.create(user=user, school_class=sc)
                except SchoolClass.DoesNotExist:
                    errors.append(f'Запись {i+1}: класс {class_id} не найден')
            created.append(user)
        except Exception as e:
            errors.append(f'Запись {i+1}: {str(e)}')

    return Response({
        'created': UserListSerializer(created, many=True).data,
        'errors': errors,
        'warnings': warnings,
    }, status=status.HTTP_201_CREATED)


# --- Common endpoints ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def user_list_create_view(request):
    if request.method == 'GET':
        users = User.objects.all().order_by('last_name', 'first_name')

        role = request.query_params.get('role')
        if role:
            filter_map = {
                'admin': {'is_admin': True},
                'teacher': {'is_teacher': True},
                'parent': {'is_parent': True},
                'student': {'is_student': True},
            }
            if role in filter_map:
                users = users.filter(**filter_map[role])

        search = request.query_params.get('search')
        if search:
            users = users.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )

        serializer = UserListSerializer(users, many=True)
        return Response(serializer.data)

    serializer = UserCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data
    user = create_user_with_temp_password(
        d['first_name'], d['last_name'], d.get('roles', []),
        d.get('email', ''), d.get('phone', ''),
    )
    return Response(UserListSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def user_detail_view(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Пользователь не найден'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(UserListSerializer(user).data)

    if request.method == 'PUT':
        data = request.data
        user.first_name = data.get('first_name', user.first_name)
        user.last_name = data.get('last_name', user.last_name)
        user.email = data.get('email', user.email)
        user.phone = data.get('phone', user.phone)

        roles = data.get('roles')
        if roles is not None:
            user.is_admin = 'admin' in roles
            user.is_teacher = 'teacher' in roles
            user.is_parent = 'parent' in roles
            user.is_student = 'student' in roles
            user.is_staff = user.is_admin

        user.save()

        # Update student class if provided
        school_class_id = data.get('school_class')
        if user.is_student and school_class_id is not None:
            if school_class_id:
                try:
                    sc = SchoolClass.objects.get(pk=school_class_id)
                    sp, _ = StudentProfile.objects.get_or_create(user=user)
                    sp.school_class = sc
                    sp.save()
                except SchoolClass.DoesNotExist:
                    pass
            else:
                StudentProfile.objects.filter(user=user).update(school_class=None)

        return Response(UserListSerializer(user).data)

    if request.method == 'DELETE':
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAdmin, PasswordChanged])
def reset_password_view(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Пользователь не найден'}, status=status.HTTP_404_NOT_FOUND)

    new_password = reset_user_password(user)
    return Response({'temp_password': new_password})


@api_view(['POST'])
@permission_classes([IsAdmin, PasswordChanged])
@parser_classes([MultiPartParser])
def import_users_view(request):
    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'Файл не загружен'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        created, errors = import_users(file)
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'created_count': len(created),
        'created': UserListSerializer(created, many=True).data,
        'errors': errors,
    })
