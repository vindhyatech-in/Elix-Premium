from django import template

register = template.Library()


@register.filter
def times(number):
    """Usage: {% for _ in n|times %}★{% endfor %} — renders n repetitions."""
    try:
        return range(int(number))
    except (TypeError, ValueError):
        return range(0)
