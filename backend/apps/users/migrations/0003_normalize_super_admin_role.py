from django.db import migrations


def normalize_super_admin_role(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.using(schema_editor.connection.alias).filter(
        role="SUPERADMIN",
    ).update(role="SUPER_ADMIN")


class Migration(migrations.Migration):
    dependencies = [("users", "0002_address_userprofile")]

    operations = [
        migrations.RunPython(normalize_super_admin_role, migrations.RunPython.noop),
    ]
