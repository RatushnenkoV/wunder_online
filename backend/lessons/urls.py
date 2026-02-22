from django.urls import path
from . import views

urlpatterns = [
    # Папки
    path('folders/', views.folder_list_create),
    path('folders/<int:folder_id>/', views.folder_detail),
    path('folders/<int:folder_id>/contents/', views.folder_contents),

    # Уроки
    path('lessons/', views.lesson_list_create),
    path('lessons/<int:lesson_id>/', views.lesson_detail),
    path('lessons/<int:lesson_id>/duplicate/', views.lesson_duplicate),

    # Медиафайлы
    path('lessons/<int:lesson_id>/upload/', views.upload_media),

    # Слайды
    path('lessons/<int:lesson_id>/slides/', views.slide_list_create),
    path('lessons/<int:lesson_id>/slides/reorder/', views.slides_reorder),
    path('lessons/<int:lesson_id>/slides/<int:slide_id>/', views.slide_detail),
    path('lessons/<int:lesson_id>/slides/<int:slide_id>/image/', views.slide_image_upload),
]
