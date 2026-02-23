from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings


@database_sync_to_async
def get_user(user_id):
    User = get_user_model()
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware:
    """
    JWT-аутентификация для WebSocket-соединений.
    Токен передаётся как query-параметр: ?token=<jwt>
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            token = token_list[0]
            try:
                UntypedToken(token)
                decoded = jwt_decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                user_id = decoded.get('user_id')
                scope['user'] = await get_user(user_id)
            except (InvalidToken, TokenError, Exception):
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)
