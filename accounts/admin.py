from django.contrib import admin

from .models import Address, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone')
    search_fields = ('user__email', 'phone')


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('label', 'user', 'pincode', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('label', 'text', 'user__email')
