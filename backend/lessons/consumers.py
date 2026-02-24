import json
import uuid

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Slide


class DiscussionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.slide_id = self.scope['url_route']['kwargs']['slide_id']
        self.room_group_name = f'discussion_{self.slide_id}'
        self.user = self.scope['user']

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        slide = await self.get_slide()
        if slide is None:
            await self.close(code=4004)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        content = slide.content or {}
        await self.send(text_data=json.dumps({
            'type': 'init',
            'stickers': content.get('stickers', []),
            'strokes': content.get('strokes', []),
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type')

        if msg_type == 'add_sticker':
            sticker = {
                'id': str(uuid.uuid4()),
                'x': data.get('x', 100),
                'y': data.get('y', 100),
                'text': data.get('text', ''),
                'color': data.get('color', '#fef08a'),
                'author_id': self.user.id,
                'author_name': f'{self.user.first_name} {self.user.last_name}'.strip(),
                'created_at': data.get('created_at', ''),
            }
            await self.save_sticker(sticker)
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'sticker_added', 'sticker': sticker},
            )

        elif msg_type == 'update_sticker':
            sticker_id = data.get('id')
            updates = {k: data[k] for k in ('x', 'y', 'text') if k in data}
            updated = await self.do_update_sticker(sticker_id, updates)
            if updated:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'sticker_updated', 'sticker': updated},
                )

        elif msg_type == 'delete_sticker':
            sticker_id = data.get('id')
            allowed = await self.can_delete_sticker(sticker_id)
            if allowed:
                await self.do_remove_sticker(sticker_id)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'sticker_deleted', 'id': sticker_id},
                )

        elif msg_type == 'add_stroke':
            stroke = data.get('stroke')
            if stroke:
                await self.do_save_stroke(stroke)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'stroke_added', 'stroke': stroke},
                )

        elif msg_type == 'clear_strokes':
            await self.do_clear_strokes()
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'strokes_cleared'},
            )

    # ── Group message handlers ──────────────────────────────────────────────────

    async def sticker_added(self, event):
        await self.send(text_data=json.dumps({
            'type': 'sticker_added', 'sticker': event['sticker'],
        }))

    async def sticker_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'sticker_updated', 'sticker': event['sticker'],
        }))

    async def sticker_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'sticker_deleted', 'id': event['id'],
        }))

    async def stroke_added(self, event):
        await self.send(text_data=json.dumps({
            'type': 'stroke_added', 'stroke': event['stroke'],
        }))

    async def strokes_cleared(self, event):
        await self.send(text_data=json.dumps({'type': 'strokes_cleared'}))

    # ── DB helpers ──────────────────────────────────────────────────────────────

    @sync_to_async
    def get_slide(self):
        try:
            return Slide.objects.get(id=self.slide_id)
        except Slide.DoesNotExist:
            return None

    @sync_to_async
    def save_sticker(self, sticker):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            stickers = list(content.get('stickers', []))
            stickers.append(sticker)
            content['stickers'] = stickers
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass

    @sync_to_async
    def do_update_sticker(self, sticker_id, updates):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            stickers = list(content.get('stickers', []))
            for s in stickers:
                if s.get('id') == sticker_id:
                    s.update(updates)
                    content['stickers'] = stickers
                    slide.content = content
                    slide.save()
                    return s
        except Slide.DoesNotExist:
            pass
        return None

    @sync_to_async
    def can_delete_sticker(self, sticker_id):
        if self.user.is_admin:
            return True
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = slide.content or {}
            for s in content.get('stickers', []):
                if s.get('id') == sticker_id:
                    return s.get('author_id') == self.user.id
        except Slide.DoesNotExist:
            pass
        return False

    @sync_to_async
    def do_remove_sticker(self, sticker_id):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            content['stickers'] = [s for s in content.get('stickers', []) if s.get('id') != sticker_id]
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass

    @sync_to_async
    def do_save_stroke(self, stroke):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            strokes = list(content.get('strokes', []))
            strokes.append(stroke)
            content['strokes'] = strokes
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass

    @sync_to_async
    def do_clear_strokes(self):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            content['strokes'] = []
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass
