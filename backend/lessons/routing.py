from django.urls import path

from .consumers import DiscussionConsumer

websocket_urlpatterns = [
    path('ws/discussion/<int:slide_id>/', DiscussionConsumer.as_asgi()),
]
