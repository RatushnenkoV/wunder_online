from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import PasswordChanged
from .models import NewsPost, NewsImage, NewsRead
from .serializers import NewsPostSerializer


def _visible_qs(user):
    """Return queryset of posts visible to this user."""
    if user.is_admin:
        return NewsPost.objects.all()
    if user.is_teacher or user.is_spps:
        return NewsPost.objects.filter(is_published=True, for_staff=True)
    if user.is_parent or user.is_student:
        # for_parents now means «ученики и родители»
        return NewsPost.objects.filter(is_published=True, for_parents=True)
    return NewsPost.objects.none()


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def post_list_create(request):
    if request.method == 'GET':
        qs = _visible_qs(request.user).prefetch_related('reads').select_related('author')
        try:
            limit = min(int(request.query_params.get('limit', 10)), 100)
            offset = int(request.query_params.get('offset', 0))
        except (ValueError, TypeError):
            limit, offset = 10, 0
        total = qs.count()
        page = qs[offset:offset + limit]
        return Response({
            'results': NewsPostSerializer(page, many=True, context={'request': request}).data,
            'count': total,
        })

    # POST — admin only
    if not request.user.is_admin:
        return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    post = NewsPost.objects.create(
        title=data.get('title', '').strip(),
        content=data.get('content', ''),
        author=request.user,
        is_published=False,
        for_staff=bool(data.get('for_staff', False)),
        for_parents=bool(data.get('for_parents', False)),
    )
    return Response(NewsPostSerializer(post, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def post_detail(request, pk):
    if request.user.is_admin:
        qs = NewsPost.objects.all()
    else:
        qs = _visible_qs(request.user)

    try:
        post = qs.prefetch_related('reads').select_related('author').get(pk=pk)
    except NewsPost.DoesNotExist:
        return Response({'detail': 'Не найдено.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        if post.is_published:
            NewsRead.objects.get_or_create(post=post, user=request.user)
        return Response(NewsPostSerializer(post, context={'request': request}).data)

    if not request.user.is_admin:
        return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        data = request.data
        post.title = data.get('title', post.title)
        post.content = data.get('content', post.content)
        post.for_staff = bool(data.get('for_staff', post.for_staff))
        post.for_parents = bool(data.get('for_parents', post.for_parents))
        if 'is_published' in data:
            can_publish = post.for_staff or post.for_parents
            post.is_published = bool(data['is_published']) and can_publish
        post.save()
        return Response(NewsPostSerializer(post, context={'request': request}).data)

    # DELETE
    post.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def publish_toggle(request, pk):
    if not request.user.is_admin:
        return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        post = NewsPost.objects.get(pk=pk)
    except NewsPost.DoesNotExist:
        return Response({'detail': 'Не найдено.'}, status=status.HTTP_404_NOT_FOUND)

    if not post.is_published and not (post.for_staff or post.for_parents):
        return Response(
            {'detail': 'Нельзя опубликовать: не выбрана аудитория.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    post.is_published = not post.is_published
    post.save(update_fields=['is_published'])
    return Response({'is_published': post.is_published})


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def upload_image(request):
    if not request.user.is_admin:
        return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)

    file = request.FILES.get('image')
    if not file:
        return Response({'detail': 'Файл не передан.'}, status=status.HTTP_400_BAD_REQUEST)

    img = NewsImage.objects.create(image=file, uploaded_by=request.user)
    url = request.build_absolute_uri(img.image.url)
    return Response({'url': url})


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def mark_read(request, pk):
    if request.user.is_admin:
        qs = NewsPost.objects.filter(is_published=True)
    else:
        qs = _visible_qs(request.user)
    try:
        post = qs.get(pk=pk)
    except NewsPost.DoesNotExist:
        return Response({'detail': 'Не найдено.'}, status=status.HTTP_404_NOT_FOUND)

    NewsRead.objects.get_or_create(post=post, user=request.user)
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def unread_count(request):
    qs = _visible_qs(request.user).filter(is_published=True)
    read_ids = NewsRead.objects.filter(user=request.user).values_list('post_id', flat=True)
    count = qs.exclude(id__in=read_ids).count()
    return Response({'count': count})
