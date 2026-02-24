from django.urls import path

from .consumers import DiscussionConsumer, LessonSessionConsumer

websocket_urlpatterns = [
    path('ws/discussion/<int:slide_id>/', DiscussionConsumer.as_asgi()),
    path('ws/session/<int:session_id>/', LessonSessionConsumer.as_asgi()),
]
