# Data migration: wrap non-JSON text values in link fields as JSON arrays.

import json
from django.db import migrations


def normalize_nonjson_link_fields(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for field in ['self_study_links', 'additional_resources', 'individual_folder']:
            cursor.execute(f"SELECT id, {field} FROM ktp_topic WHERE {field} != '[]' AND {field} != ''")
            rows = cursor.fetchall()
            for row_id, value in rows:
                if not value:
                    continue
                try:
                    json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    new_value = json.dumps([{"title": "", "url": value}])
                    cursor.execute(
                        f"UPDATE ktp_topic SET {field} = %s WHERE id = %s",
                        [new_value, row_id],
                    )


class Migration(migrations.Migration):

    dependencies = [
        ('ktp', '0007_topic_links_to_json'),
    ]

    operations = [
        migrations.RunPython(normalize_nonjson_link_fields, migrations.RunPython.noop),
    ]
