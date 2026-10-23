from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("guantou", "0026_recordingcomment_reply_to")]

    operations = [
        migrations.AddField(
            model_name="curationaction",
            name="authority_snapshot",
            field=models.JSONField(
                default=dict, db_default={}, blank=True, verbose_name="操作时授权快照"
            ),
        ),
    ]
