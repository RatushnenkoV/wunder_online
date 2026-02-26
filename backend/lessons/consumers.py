import json
import logging
import uuid

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Slide, LessonSession, FormAnswer
from .utils import compute_form_results

logger = logging.getLogger(__name__)


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

        try:
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        except Exception:
            await self.accept()
            await self.close(code=1011)
            return

        await self.accept()

        content = slide.content or {}
        await self.send(text_data=json.dumps({
            'type': 'init',
            'stickers': content.get('stickers', []),
            'arrows': content.get('arrows', []),
            'topic': content.get('topic', ''),
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

        elif msg_type == 'add_arrow':
            from_id = data.get('from_id')
            to_id = data.get('to_id')
            if from_id and to_id:
                arrow = {
                    'id': str(uuid.uuid4()),
                    'from_id': from_id,
                    'to_id': to_id,
                    'author_id': self.user.id,
                    'author_name': f'{self.user.first_name} {self.user.last_name}'.strip(),
                }
                await self.save_arrow(arrow)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'arrow_added', 'arrow': arrow},
                )

        elif msg_type == 'delete_arrow':
            arrow_id = data.get('id')
            allowed = await self.can_delete_arrow(arrow_id)
            if allowed:
                await self.do_remove_arrow(arrow_id)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'arrow_deleted', 'id': arrow_id},
                )

        elif msg_type == 'update_topic':
            if self.user.is_teacher or self.user.is_admin:
                topic = str(data.get('topic', ''))[:200]
                await self.do_update_topic(topic)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'topic_updated', 'topic': topic},
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

    async def arrow_added(self, event):
        await self.send(text_data=json.dumps({
            'type': 'arrow_added', 'arrow': event['arrow'],
        }))

    async def arrow_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'arrow_deleted', 'id': event['id'],
        }))

    async def topic_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'topic_updated', 'topic': event['topic'],
        }))

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
        if self.user.is_admin or self.user.is_teacher:
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
            content['stickers'] = [
                s for s in content.get('stickers', []) if s.get('id') != sticker_id
            ]
            # Remove arrows that referenced this sticker
            content['arrows'] = [
                a for a in content.get('arrows', [])
                if a.get('from_id') != sticker_id and a.get('to_id') != sticker_id
            ]
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass

    @sync_to_async
    def save_arrow(self, arrow):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            arrows = list(content.get('arrows', []))
            arrows.append(arrow)
            content['arrows'] = arrows
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass

    @sync_to_async
    def can_delete_arrow(self, arrow_id):
        if self.user.is_admin or self.user.is_teacher:
            return True
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = slide.content or {}
            for a in content.get('arrows', []):
                if a.get('id') == arrow_id:
                    return a.get('author_id') == self.user.id
        except Slide.DoesNotExist:
            pass
        return False

    @sync_to_async
    def do_remove_arrow(self, arrow_id):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            content['arrows'] = [a for a in content.get('arrows', []) if a.get('id') != arrow_id]
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass

    @sync_to_async
    def do_update_topic(self, topic):
        try:
            slide = Slide.objects.get(id=self.slide_id)
            content = dict(slide.content or {})
            content['topic'] = topic
            slide.content = content
            slide.save()
        except Slide.DoesNotExist:
            pass


# ─── LessonSessionConsumer ────────────────────────────────────────────────────

class LessonSessionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'lesson_session_{self.session_id}'
        self.user = self.scope['user']

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        session = await self.get_session()
        if session is None:
            await self.close(code=4004)
            return

        # Студентам нельзя подключаться к завершённой сессии
        is_presenter = session.teacher_id == self.user.id or self.user.is_admin
        if not session.is_active and not is_presenter:
            await self.close(code=4403)
            return

        try:
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        except Exception as e:
            logger.error('[LessonSession] group_add failed: %s: %s', type(e).__name__, e, exc_info=True)
            await self.accept()
            await self.close(code=1011)
            return

        await self.accept()

        await self.send(text_data=json.dumps({
            'type': 'init',
            'session_id': session.id,
            'current_slide_id': session.current_slide_id,
            'is_active': session.is_active,
        }))
        logger.info('[LessonSession] user %s connected to session %s (presenter=%s)',
                    self.user.id, self.session_id,
                    session.teacher_id == self.user.id or self.user.is_admin)

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        logger.info('[LessonSession] receive raw: %s', text_data[:120])
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        session = await self.get_session()
        if session is None:
            logger.warning('[LessonSession] session %s not found in receive', self.session_id)
            return

        msg_type = data.get('type')

        # form_answer доступен ВСЕМ аутентифицированным участникам (не только учителю)
        if msg_type == 'form_answer':
            slide_id = data.get('slide_id')
            answers = data.get('answers', [])
            logger.info('[LessonSession] form_answer received: user=%s slide_id=%s answers_count=%s',
                        self.user.id, slide_id, len(answers) if isinstance(answers, list) else '?')
            if slide_id and isinstance(answers, list):
                await self.save_form_answer(slide_id, answers)
                try:
                    results = await self.get_form_results(slide_id)
                    logger.info('[LessonSession] form_answer broadcast to group %s', self.room_group_name)
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {'type': 'form_results_updated', 'slide_id': slide_id, 'results': results},
                    )
                except Exception as e:
                    logger.error('[LessonSession] form_answer broadcast failed: %s', e)
            else:
                logger.warning('[LessonSession] form_answer bad data: slide_id=%s answers type=%s',
                               slide_id, type(answers).__name__)
            return

        # Остальные команды — только для учителя/admin
        is_presenter = session.teacher_id == self.user.id or self.user.is_admin
        logger.info('[LessonSession] is_presenter=%s  teacher_id=%s  user_id=%s',
                    is_presenter, session.teacher_id, self.user.id)
        if not is_presenter:
            return

        if msg_type == 'set_slide':
            slide_id = data.get('slide_id')
            if slide_id:
                await self.do_set_slide(slide_id)
                try:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {'type': 'slide_changed', 'slide_id': slide_id},
                    )
                    logger.info('[LessonSession] group_send slide_changed slide_id=%s to %s',
                                slide_id, self.room_group_name)
                except Exception as e:
                    logger.error('[LessonSession] group_send failed: %s', e)

        elif msg_type == 'end_session':
            await self.do_end_session()
            try:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'session_ended'},
                )
            except Exception as e:
                logger.error('[LessonSession] group_send end_session failed: %s', e)

        elif msg_type == 'video_control':
            action = data.get('action')
            if action in ('play', 'pause'):
                try:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {'type': 'video_control', 'action': action},
                    )
                except Exception as e:
                    logger.error('[LessonSession] video_control broadcast failed: %s', e)

    # ── Group message handlers ────────────────────────────────────────────────

    async def slide_changed(self, event):
        await self.send(text_data=json.dumps({
            'type': 'slide_changed',
            'slide_id': event['slide_id'],
        }))

    async def session_ended(self, event):
        await self.send(text_data=json.dumps({'type': 'session_ended'}))

    async def form_results_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'form_results_updated',
            'slide_id': event['slide_id'],
            'results': event['results'],
        }))

    async def video_control(self, event):
        await self.send(text_data=json.dumps({
            'type': 'video_control',
            'action': event['action'],
        }))

    # ── DB helpers ────────────────────────────────────────────────────────────

    @sync_to_async
    def get_session(self):
        try:
            return LessonSession.objects.get(id=self.session_id)
        except LessonSession.DoesNotExist:
            return None

    @sync_to_async
    def do_set_slide(self, slide_id):
        try:
            session = LessonSession.objects.get(id=self.session_id)
            session.current_slide_id = slide_id
            session.save(update_fields=['current_slide'])
        except LessonSession.DoesNotExist:
            pass

    @sync_to_async
    def save_form_answer(self, slide_id, answers):
        FormAnswer.objects.update_or_create(
            session_id=self.session_id,
            slide_id=slide_id,
            student=self.user,
            defaults={'answers': answers},
        )

    @sync_to_async
    def get_form_results(self, slide_id):
        try:
            slide = Slide.objects.get(id=slide_id)
            fa_qs = FormAnswer.objects.filter(
                session_id=self.session_id, slide_id=slide_id,
            ).select_related('student')
            return compute_form_results(slide, fa_qs)
        except Exception:
            return {'summary': {'answered_count': 0, 'total_questions': 0, 'per_question': []}, 'details': []}

    @sync_to_async
    def do_end_session(self):
        from django.utils import timezone
        try:
            session = LessonSession.objects.get(id=self.session_id)
            session.is_active = False
            session.ended_at = timezone.now()
            session.save(update_fields=['is_active', 'ended_at'])
        except LessonSession.DoesNotExist:
            pass
