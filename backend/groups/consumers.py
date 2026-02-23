import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Group, GroupMessage
from .serializers import GroupMessageSerializer


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.room_group_name = f'chat_{self.group_id}'
        self.user = self.scope['user']

        # Отклонить неаутентифицированных
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        # Проверить членство в группе
        is_member = await self.check_membership()
        if not is_member:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type', 'message')

        if msg_type == 'message':
            content = data.get('content', '').strip()
            if not content:
                return

            message = await self.save_message(content)
            serialized = await self.serialize_message(message)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': serialized,
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['message']))

    @sync_to_async
    def check_membership(self):
        try:
            group = Group.objects.get(id=self.group_id)
            return (
                group.members.filter(id=self.user.id).exists()
                or self.user.is_admin
            )
        except Group.DoesNotExist:
            return False

    @sync_to_async
    def save_message(self, content):
        group = Group.objects.get(id=self.group_id)
        return GroupMessage.objects.create(
            group=group,
            sender=self.user,
            content=content,
            message_type=GroupMessage.TYPE_TEXT,
        )

    @sync_to_async
    def serialize_message(self, message):
        serializer = GroupMessageSerializer(message)
        return serializer.data
