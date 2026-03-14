from collections import Counter
from rest_framework import serializers
from .models import NewsPost


class NewsPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()

    class Meta:
        model = NewsPost
        fields = [
            'id', 'title', 'content', 'author_name',
            'created_at', 'updated_at',
            'is_published', 'for_staff', 'for_parents', 'is_read',
            'reactions', 'my_reaction',
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

    def get_reactions(self, obj):
        """Return {emoji: count} dict for this post."""
        counts = Counter(r.emoji for r in obj.reactions.all())
        return dict(counts)

    def get_my_reaction(self, obj):
        """Return the current user's emoji, or None."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        r = obj.reactions.filter(user=request.user).first()
        return r.emoji if r else None
