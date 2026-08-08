import re

from django.contrib.auth.models import User


def generate_username_from_name(first_name, last_name=''):
    """
    firstname+lastname, lowercased, collision-suffixed with an incrementing
    number — the same rule employee logins use (see
    core/admin_dashboard_views.py::_create_employee_login), now shared so
    customer signup can generate IDs the identical way.
    """
    base = re.sub(r'[^a-z0-9]', '', (first_name + last_name).lower()) or 'user'
    username = base
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f'{base}{suffix}'
    return username
