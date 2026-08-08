from allauth.account.fields import PhoneField

DEFAULT_COUNTRY_CODE = '+91'


class IndianPhoneField(PhoneField):
    """
    Same as allauth's own PhoneField, except a number typed without a
    country code (e.g. "9876543210") is assumed to be Indian and gets
    +91 prepended automatically instead of failing E.164 validation —
    this business only operates in India (see SITE_PHONE/SITE_ADDRESS in
    settings.py), so that's a safe default rather than forcing every
    customer to type +91 themselves.
    """

    def to_python(self, value):
        value = super().to_python(value)
        if value:
            value = value.strip().replace(' ', '').replace('-', '')
            if value and not value.startswith('+'):
                value = f'{DEFAULT_COUNTRY_CODE}{value}'
        return value
