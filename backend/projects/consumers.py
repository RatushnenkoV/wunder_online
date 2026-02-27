import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Project, ProjectMember, ProjectPost
from .serializers import ProjectPostSerializer


class ProjectConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.project_id = self.scope['url_route']['kwargs']['project_id']
        self.group_name = f'project_{self.project_id}'
        self.user = self.scope['user']

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        is_member = await self.check_membership()
        if not is_member:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type')

        if msg_type == 'send_post':
            text = data.get('text', '').strip()
            if not text:
                return
            post = await self.save_post(text)
            serialized = await self.serialize_post(post)
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'project_post_new', 'post': serialized},
            )

        elif msg_type == 'typing':
            first = self.user.first_name or ''
            display_name = (
                f'{self.user.last_name} {first[0]}.' if first else self.user.last_name
            )
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'project_user_typing',
                    'user_id': self.user.id,
                    'display_name': display_name,
                },
            )

    # ─── Event handlers ────────────────────────────────────────────────────────

    async def project_post_new(self, event):
        await self.send(text_data=json.dumps({
            'type': 'post_new',
            'post': event['post'],
        }))

    async def project_post_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'post_deleted',
            'post_id': event['post_id'],
        }))

    async def project_post_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'post_updated',
            'post': event['post'],
        }))

    async def project_user_typing(self, event):
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'user_typing',
                'user_id': event['user_id'],
                'display_name': event['display_name'],
            }))

    # ─── DB helpers ────────────────────────────────────────────────────────────

    @sync_to_async
    def check_membership(self):
        try:
            project = Project.objects.get(id=self.project_id)
            return (
                self.user.is_admin
                or project.members_rel.filter(user=self.user).exists()
            )
        except Project.DoesNotExist:
            return False

    @sync_to_async
    def save_post(self, text):
        project = Project.objects.get(id=self.project_id)
        return ProjectPost.objects.create(
            project=project,
            author=self.user,
            text=text,
        )

    @sync_to_async
    def serialize_post(self, post):
        serializer = ProjectPostSerializer(post)
        return serializer.data
