import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from .models import ChatRoom, ChatMember, ChatMessage
from .serializers import ChatMessageSerializer


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        self.user = self.scope['user']

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

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

        msg_type = data.get('type')

        if msg_type == 'send_message':
            text = data.get('text', '').strip()
            reply_to_id = data.get('reply_to')
            if not text:
                return
            message = await self.save_message(text, reply_to_id)
            serialized = await self.serialize_message(message)
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'chat_message_new', 'message': serialized},
            )

        elif msg_type == 'mark_read':
            await self.mark_read()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_room_read',
                    'user_id': self.user.id,
                    'last_read_at': timezone.now().isoformat(),
                },
            )

        elif msg_type == 'typing':
            first = self.user.first_name or ''
            display_name = f'{self.user.last_name} {first[0]}.' if first else self.user.last_name
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_user_typing',
                    'user_id': self.user.id,
                    'display_name': display_name,
                },
            )

    # ─── Event handlers ────────────────────────────────────────────────────────

    async def chat_message_new(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_new',
            'message': event['message'],
        }))

    async def chat_room_read(self, event):
        await self.send(text_data=json.dumps({
            'type': 'room_read',
            'user_id': event['user_id'],
            'last_read_at': event['last_read_at'],
        }))

    async def chat_user_typing(self, event):
        # не отправлять самому себе
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'user_typing',
                'user_id': event['user_id'],
                'display_name': event['display_name'],
            }))

    async def chat_message_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id'],
        }))

    async def chat_poll_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'poll_updated',
            'poll_id': event['poll_id'],
            'options': event['options'],
            'total_votes': event['total_votes'],
        }))

    async def chat_task_taken(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_task_taken',
            'task_id': event['task_id'],
            'takers': event['takers'],
        }))

    # ─── DB helpers ────────────────────────────────────────────────────────────

    @sync_to_async
    def check_membership(self):
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            return (
                room.members_rel.filter(user=self.user).exists()
                or self.user.is_admin
            )
        except ChatRoom.DoesNotExist:
            return False

    @sync_to_async
    def save_message(self, text, reply_to_id=None):
        room = ChatRoom.objects.get(id=self.room_id)
        reply_to = None
        if reply_to_id:
            try:
                reply_to = ChatMessage.objects.get(id=reply_to_id, room=room)
            except ChatMessage.DoesNotExist:
                pass
        return ChatMessage.objects.create(
            room=room,
            sender=self.user,
            text=text,
            reply_to=reply_to,
        )

    @sync_to_async
    def serialize_message(self, message):
        serializer = ChatMessageSerializer(message)
        return serializer.data

    @sync_to_async
    def mark_read(self):
        ChatMember.objects.filter(
            room_id=self.room_id,
            user=self.user,
        ).update(last_read_at=timezone.now())
