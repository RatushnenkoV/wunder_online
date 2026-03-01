from rest_framework import serializers
from .models import CuratorSection, CuratorField, CuratorHint, CuratorReport, CuratorReportValue


class CuratorHintSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuratorHint
        fields = ['id', 'field', 'text']


class CuratorFieldSerializer(serializers.ModelSerializer):
    hints = CuratorHintSerializer(many=True, read_only=True)

    class Meta:
        model = CuratorField
        fields = ['id', 'name', 'order', 'hints']


class CuratorSectionSerializer(serializers.ModelSerializer):
    fields = CuratorFieldSerializer(many=True, read_only=True)

    class Meta:
        model = CuratorSection
        fields = ['id', 'name', 'order', 'fields']


class CuratorReportValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuratorReportValue
        fields = ['field', 'value']


class CuratorReportSerializer(serializers.ModelSerializer):
    values = CuratorReportValueSerializer(many=True, read_only=True)

    class Meta:
        model = CuratorReport
        fields = ['id', 'student', 'academic_year', 'updated_at', 'values']
