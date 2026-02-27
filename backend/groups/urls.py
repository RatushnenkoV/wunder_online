from django.urls import path

from .views import (
    ChatRoomListView, ChatRoomDetailView,
    ChatMembersView, ChatMessagesView,
    ChatFileUploadView, ChatReadView,
    ChatUsersView, ChatDirectView,
)

urlpatterns = [
    path('rooms/', ChatRoomListView.as_view()),
    path('rooms/<int:pk>/', ChatRoomDetailView.as_view()),
    path('rooms/<int:pk>/members/', ChatMembersView.as_view()),
    path('rooms/<int:pk>/members/<int:user_pk>/', ChatMembersView.as_view()),
    path('rooms/<int:pk>/messages/', ChatMessagesView.as_view()),
    path('rooms/<int:pk>/messages/<int:msg_id>/', ChatMessagesView.as_view()),
    path('rooms/<int:pk>/files/', ChatFileUploadView.as_view()),
    path('rooms/<int:pk>/read/', ChatReadView.as_view()),
    path('users/', ChatUsersView.as_view()),
    path('direct/', ChatDirectView.as_view()),
]
