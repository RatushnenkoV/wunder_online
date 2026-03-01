from django.urls import path
from . import views

urlpatterns = [
    # Папки
    path('folders/', views.folder_list_create),
    path('folders/<int:folder_id>/', views.folder_detail),
    path('folders/<int:folder_id>/contents/', views.folder_contents),

    # Импорт
    path('import/', views.import_presentation),

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

    # Сессии
    path('sessions/', views.session_list_create),
    path('sessions/active/', views.sessions_active),
    path('sessions/<int:session_id>/', views.session_detail),
    path('sessions/<int:session_id>/slides/<int:slide_id>/form-results/', views.session_form_results),
    path('sessions/<int:session_id>/slides/<int:slide_id>/vocab-progress/', views.vocab_progress),
    path('sessions/<int:session_id>/slides/<int:slide_id>/textbook-annotations/', views.textbook_annotations),

    # Обзор для «Все уроки»
    path('school-overview/', views.school_lessons_overview),
    path('teacher-root/', views.teacher_root_content),

    # Учебники
    path('textbooks/', views.textbook_list_create),
    path('textbooks/grade-levels/', views.textbook_grade_levels),
    path('textbooks/<int:textbook_id>/', views.textbook_detail),

    # Выдача уроков (самостоятельное прохождение)
    path('assignments/', views.lesson_assignments),
    path('assignments/<int:assignment_id>/', views.lesson_assignment_detail),
]
