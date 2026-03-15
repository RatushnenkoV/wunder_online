from django.urls import path
from . import views

urlpatterns = [
    path('', views.event_list_create),
    path('import/', views.event_import),
    path('<int:pk>/', views.event_detail),
]
