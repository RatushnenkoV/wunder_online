from django.urls import path

from .consumers import ChatConsumer

websocket_urlpatterns = [
    path('ws/groups/<int:group_id>/', ChatConsumer.as_asgi()),
]
