from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/', views.login_view),
    path('auth/change-password/', views.change_password_view),
    path('auth/me/', views.me_view),
    path('admin/users/', views.user_list_create_view),
    path('admin/users/<int:pk>/', views.user_detail_view),
    path('admin/users/<int:pk>/reset-password/', views.reset_password_view),
    path('admin/users/import/', views.import_users_view),
    path('admin/staff/', views.staff_list_create),
    path('admin/students/', views.student_list_create),
]
