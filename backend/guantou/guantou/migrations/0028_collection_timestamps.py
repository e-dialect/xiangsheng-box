from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("guantou", "0027_curationaction_authority_snapshot")]

    # Historical timestamps are unknown. Add nullable columns first so migration
    # time is not fabricated as the original join/edit time of existing data.
    operations = [
        migrations.AddField(
            model_name="collection",
            name="updated_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.AddField(
            model_name="collectionentry",
            name="created_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.AddField(
            model_name="collectionrecording",
            name="created_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.AlterField(
            model_name="collection",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AlterField(
            model_name="collectionentry",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AlterField(
            model_name="collectionrecording",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
    ]
