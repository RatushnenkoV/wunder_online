from django.db import models as django_models
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import PasswordChanged
from .models import Lesson, LessonFolder, Slide, LessonMedia
from .serializers import LessonFolderSerializer, LessonSerializer, SlideSerializer, LessonMediaSerializer


def _ctx(request):
    return {'request': request}


def _is_staff(user):
    return user.is_admin or user.is_teacher


# ─── Папки ────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def folder_list_create(request):
    """GET: мои папки (верхнего уровня). POST: создать папку."""
    if request.method == 'GET':
        folders = LessonFolder.objects.filter(
            owner=request.user, parent=None
        ).prefetch_related('children', 'lessons')
        return Response(LessonFolderSerializer(folders, many=True, context=_ctx(request)).data)

    if not _is_staff(request.user):
        return Response({'error': 'Только учителя могут создавать папки'}, status=403)

    serializer = LessonFolderSerializer(data=request.data, context=_ctx(request))
    if serializer.is_valid():
        serializer.save(owner=request.user)
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def folder_detail(request, folder_id):
    folder = get_object_or_404(LessonFolder, id=folder_id)

    if request.method == 'GET':
        return Response(LessonFolderSerializer(folder, context=_ctx(request)).data)

    # Изменять/удалять может только владелец или admin
    if folder.owner_id != request.user.id and not request.user.is_admin:
        return Response({'error': 'Нет доступа'}, status=403)

    if request.method == 'PUT':
        serializer = LessonFolderSerializer(folder, data=request.data, partial=True, context=_ctx(request))
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    folder.delete()
    return Response(status=204)


@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def folder_contents(request, folder_id):
    """Содержимое папки: вложенные папки + уроки."""
    folder = get_object_or_404(LessonFolder, id=folder_id)

    # Только владелец или admin видит содержимое
    if folder.owner_id != request.user.id and not request.user.is_admin:
        return Response({'error': 'Нет доступа'}, status=403)

    subfolders = folder.children.all()
    lessons = folder.lessons.all()

    return Response({
        'folder': LessonFolderSerializer(folder, context=_ctx(request)).data,
        'subfolders': LessonFolderSerializer(subfolders, many=True, context=_ctx(request)).data,
        'lessons': LessonSerializer(lessons, many=True, context=_ctx(request)).data,
    })


# ─── Уроки ────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def lesson_list_create(request):
    """
    GET ?tab=mine|all&folder=<id>
    POST: создать урок
    """
    if request.method == 'GET':
        tab = request.query_params.get('tab', 'mine')

        if tab == 'all':
            # Все уроки школы (только для staff/admin)
            if not _is_staff(request.user):
                return Response({'error': 'Нет доступа'}, status=403)
            lessons = Lesson.objects.select_related('owner', 'folder').all()
        else:
            # Только мои уроки
            lessons = Lesson.objects.filter(owner=request.user).select_related('owner', 'folder')

        folder_id = request.query_params.get('folder')
        if folder_id:
            lessons = lessons.filter(folder_id=folder_id)
        else:
            # Только корневые (без папки) если folder не указан
            lessons = lessons.filter(folder=None)

        return Response(LessonSerializer(lessons, many=True, context=_ctx(request)).data)

    # POST — создать урок
    if not _is_staff(request.user):
        return Response({'error': 'Только учителя могут создавать уроки'}, status=403)

    serializer = LessonSerializer(data=request.data, context=_ctx(request))
    if serializer.is_valid():
        lesson = serializer.save(owner=request.user)
        return Response(LessonSerializer(lesson, context=_ctx(request)).data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def lesson_detail(request, lesson_id):
    lesson = get_object_or_404(
        Lesson.objects.select_related('owner', 'folder'),
        id=lesson_id,
    )

    if request.method == 'GET':
        return Response(LessonSerializer(lesson, context=_ctx(request)).data)

    # Изменять/удалять может владелец или admin
    if lesson.owner_id != request.user.id and not request.user.is_admin:
        return Response({'error': 'Нет доступа'}, status=403)

    if request.method == 'PUT':
        serializer = LessonSerializer(lesson, data=request.data, partial=True, context=_ctx(request))
        if serializer.is_valid():
            lesson = serializer.save()
            return Response(LessonSerializer(lesson, context=_ctx(request)).data)
        return Response(serializer.errors, status=400)

    lesson.delete()
    return Response(status=204)


# ─── Слайды ───────────────────────────────────────────────────────────────────

def _can_edit_lesson(lesson, user):
    return lesson.owner_id == user.id or user.is_admin


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def slide_list_create(request, lesson_id):
    lesson = get_object_or_404(Lesson.objects.select_related('owner'), id=lesson_id)

    if request.method == 'GET':
        slides = lesson.slides.all()
        return Response(SlideSerializer(slides, many=True, context=_ctx(request)).data)

    if not _can_edit_lesson(lesson, request.user):
        return Response({'error': 'Нет доступа'}, status=403)

    max_order = lesson.slides.aggregate(m=django_models.Max('order'))['m']
    order = (max_order or 0) + 1

    slide = Slide.objects.create(
        lesson=lesson,
        order=order,
        slide_type=request.data.get('slide_type', Slide.TYPE_CONTENT),
        title=request.data.get('title', ''),
        content=request.data.get('content', {}),
    )
    return Response(SlideSerializer(slide, context=_ctx(request)).data, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def slide_detail(request, lesson_id, slide_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    slide = get_object_or_404(Slide, id=slide_id, lesson=lesson)

    if request.method == 'GET':
        return Response(SlideSerializer(slide, context=_ctx(request)).data)

    if not _can_edit_lesson(lesson, request.user):
        return Response({'error': 'Нет доступа'}, status=403)

    if request.method == 'PUT':
        if 'title' in request.data:
            slide.title = request.data['title']
        if 'slide_type' in request.data:
            slide.slide_type = request.data['slide_type']
        if 'content' in request.data:
            slide.content = request.data['content']
        slide.save()
        return Response(SlideSerializer(slide, context=_ctx(request)).data)

    slide.delete()
    return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def slides_reorder(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    if not _can_edit_lesson(lesson, request.user):
        return Response({'error': 'Нет доступа'}, status=403)

    order_ids = request.data.get('order', [])
    for idx, sid in enumerate(order_ids):
        Slide.objects.filter(id=sid, lesson=lesson).update(order=idx)

    slides = lesson.slides.all()
    return Response(SlideSerializer(slides, many=True, context=_ctx(request)).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def slide_image_upload(request, lesson_id, slide_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    slide = get_object_or_404(Slide, id=slide_id, lesson=lesson)

    if not _can_edit_lesson(lesson, request.user):
        return Response({'error': 'Нет доступа'}, status=403)

    img = request.FILES.get('image')
    if not img:
        return Response({'error': 'Файл не передан'}, status=400)

    if slide.image:
        slide.image.delete(save=False)
    slide.image = img
    slide.save()
    return Response(SlideSerializer(slide, context=_ctx(request)).data)


# ─── Медиафайлы ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def upload_media(request, lesson_id):
    """Загрузить медиафайл (изображение) для блока на слайде."""
    lesson = get_object_or_404(Lesson, id=lesson_id)
    if not _can_edit_lesson(lesson, request.user):
        return Response({'error': 'Нет доступа'}, status=403)

    f = request.FILES.get('file')
    if not f:
        return Response({'error': 'Файл не передан'}, status=400)

    media = LessonMedia.objects.create(lesson=lesson, file=f)
    return Response(LessonMediaSerializer(media, context=_ctx(request)).data, status=201)


# ─── Дублирование ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def lesson_duplicate(request, lesson_id):
    """Дублировать урок."""
    lesson = get_object_or_404(Lesson, id=lesson_id)

    if lesson.owner_id != request.user.id and not request.user.is_admin:
        return Response({'error': 'Нет доступа'}, status=403)

    new_lesson = Lesson.objects.create(
        title=f'{lesson.title} (копия)',
        description=lesson.description,
        owner=request.user,
        folder=lesson.folder,
        is_public=False,
        cover_color=lesson.cover_color,
    )
    return Response(LessonSerializer(new_lesson, context=_ctx(request)).data, status=201)
