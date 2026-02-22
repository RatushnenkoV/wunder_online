from django.urls import path
from . import views

urlpatterns = [
    path('staff/', views.staff_list),
    path('groups/', views.group_list_create),
    path('groups/<int:group_id>/', views.group_detail),
    path('groups/<int:group_id>/members/', views.group_members),
    path('tasks/count/', views.tasks_count),
    path('tasks/', views.task_list_create),
    path('tasks/<int:task_id>/', views.task_detail),
    path('tasks/<int:task_id>/status/', views.task_status_change),
    path('tasks/<int:task_id>/reassign/', views.task_reassign),
    path('tasks/<int:task_id>/files/', views.task_file_upload),
    path('tasks/<int:task_id>/files/<int:file_id>/', views.task_file_delete),
]
