from rest_framework import serializers
from .models import NewsPost


class NewsPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = NewsPost
        fields = [
            'id', 'title', 'content', 'author_name',
            'created_at', 'updated_at',
            'is_published', 'for_staff', 'for_parents', 'is_read',
        ]

    def get_author_name(self, obj):
        if obj.author:
            return f'{obj.author.last_name} {obj.author.first_name}'.strip()
        return ''

    def get_is_read(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.reads.filter(user=request.user).exists()
