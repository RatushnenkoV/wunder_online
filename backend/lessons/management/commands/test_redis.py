import asyncio

from django.core.management.base import BaseCommand
from channels.layers import get_channel_layer


class Command(BaseCommand):
    help = 'Test Redis channel layer connectivity'

    def handle(self, *args, **options):
        asyncio.run(self._test())

    async def _test(self):
        self.stdout.write('Testing channel layer...')
        try:
            layer = get_channel_layer()
            if layer is None:
                self.stdout.write(self.style.ERROR('channel_layer is None — CHANNEL_LAYERS not configured'))
                return
            self.stdout.write(f'Layer type: {type(layer).__name__}')
            await layer.group_add('test_group', 'test_channel_123')
            self.stdout.write(self.style.SUCCESS('group_add: OK'))
            await layer.group_discard('test_group', 'test_channel_123')
            self.stdout.write(self.style.SUCCESS('group_discard: OK'))
            self.stdout.write(self.style.SUCCESS('Redis channel layer is working!'))
        except Exception as e:
            import traceback
            self.stdout.write(self.style.ERROR(f'FAILED: {type(e).__name__}: {e}'))
            self.stdout.write(traceback.format_exc())
