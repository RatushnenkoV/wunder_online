from django.urls import path
from . import views

urlpatterns = [
    path('unread-count/', views.unread_count),
    path('upload-image/', views.upload_image),
    path('', views.post_list_create),
    path('<int:pk>/', views.post_detail),
    path('<int:pk>/publish/', views.publish_toggle),
    path('<int:pk>/read/', views.mark_read),
    path('<int:pk>/react/', views.react),
]
