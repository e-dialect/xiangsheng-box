import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("guantou", "0025_recordingcomment_entry_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="recordingcomment",
            name="reply_to",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="reply_targets",
                to="guantou.recordingcomment",
            ),
        ),
    ]
