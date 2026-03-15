from django.urls import path
from . import views

urlpatterns = [
    path('students/', views.students_search),
    path('unread-count/', views.unread_count),
    path('', views.entry_list_create),
    path('<int:pk>/', views.entry_detail),
    path('<int:pk>/comments/', views.add_comment),
    path('<int:pk>/create-task/', views.create_task_from_entry),
    path('student/<int:student_id>/', views.student_entries),
]
