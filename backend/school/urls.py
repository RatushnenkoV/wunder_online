from django.urls import path
from . import views

urlpatterns = [
    path('grade-levels/', views.grade_level_list_create),
    path('grade-levels/<int:pk>/', views.grade_level_delete),
    path('classes/', views.school_class_list_create),
    path('classes/<int:pk>/', views.school_class_detail),
    path('classes/<int:class_id>/students/', views.class_students),
    path('classes/import/', views.import_classes_view),
    path('students/import-excel/', views.import_students_excel_view),
    path('students/import-excel/status/<str:task_id>/', views.import_students_excel_status),
    path('subjects/', views.subject_list_create),
    path('subjects/<int:pk>/', views.subject_delete),
    path('grade-subjects/', views.grade_subject_list_create),
    path('grade-subjects/<int:pk>/', views.grade_subject_delete),
    path('students/<int:student_id>/parents/', views.student_parents),

    # Class Groups
    path('classes/<int:class_id>/groups/', views.class_group_list_create),
    path('groups/<int:pk>/', views.class_group_detail),

    # Class Subjects
    path('classes/<int:class_id>/subjects/', views.class_subject_list_create),
    path('class-subjects/<int:pk>/', views.class_subject_detail),
    path('classes/<int:class_id>/schedule-subjects/', views.class_schedule_subjects),

    # Teachers (lightweight)
    path('teachers/', views.teacher_list),

    # Rooms
    path('rooms/', views.room_list_create),
    path('rooms/<int:pk>/', views.room_delete),

    # Schedule
    path('schedule/', views.schedule_list),
    path('schedule/all/', views.schedule_all),
    path('schedule/create/', views.schedule_create),
    path('schedule/import/preview/', views.schedule_import_preview),
    path('schedule/import/confirm/', views.schedule_import_confirm),
    path('schedule/<int:pk>/', views.schedule_detail),

    # Substitutions
    path('substitutions/', views.substitution_list_create),
    path('substitutions/export/', views.substitution_export),
    path('substitutions/<int:pk>/', views.substitution_detail),

    # Lesson Time Slots
    path('lesson-times/', views.lesson_time_list_create),
    path('lesson-times/<int:pk>/', views.lesson_time_detail),

    # АХО
    path('aho/', views.aho_request_create),

    # Поиск классов/подгрупп для добавления участников
    path('class-group-search/', views.class_group_search),
]
