"""
ASGI config for config project.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Инициализировать Django до импорта channels
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from groups.middleware import JWTAuthMiddleware  # noqa: E402
from groups.routing import websocket_urlpatterns as chat_ws  # noqa: E402
from lessons.routing import websocket_urlpatterns as lessons_ws  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddleware(
        URLRouter(chat_ws + lessons_ws)
    ),
})
