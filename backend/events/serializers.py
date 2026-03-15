from rest_framework import serializers
from .models import SchoolEvent


class SchoolEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolEvent
        fields = [
            'id', 'date_start', 'date_end', 'time_note',
            'target_classes', 'organizers', 'description',
            'responsible', 'helper', 'event_type', 'approved',
            'cost', 'status', 'created_by',
        ]
        read_only_fields = ['created_by']
