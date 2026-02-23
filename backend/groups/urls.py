from django.urls import path

from .views import (
    GroupListView, GroupDetailView, GroupMembersView,
    GroupMessagesView, GroupFileUploadView, GroupTaskCreateView,
    GroupTaskUpdateView,
)

urlpatterns = [
    path('', GroupListView.as_view()),
    path('<int:pk>/', GroupDetailView.as_view()),
    path('<int:pk>/members/', GroupMembersView.as_view()),
    path('<int:pk>/members/<int:user_pk>/', GroupMembersView.as_view()),
    path('<int:pk>/messages/', GroupMessagesView.as_view()),
    path('<int:pk>/messages/file/', GroupFileUploadView.as_view()),
    path('<int:pk>/messages/task/', GroupTaskCreateView.as_view()),
    path('<int:pk>/tasks/<int:task_pk>/', GroupTaskUpdateView.as_view()),
]
