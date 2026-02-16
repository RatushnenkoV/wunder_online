from django.contrib.auth import get_user_model

User = get_user_model()


class NameAuthBackend:
    """Authenticate by first_name + last_name + password.

    When multiple users share the same name (namesakes),
    each one is tried until a password match is found.
    """

    def authenticate(self, request, first_name=None, last_name=None, password=None, **kwargs):
        users = User.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name,
        )
        for user in users:
            if user.check_password(password):
                return user
        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
