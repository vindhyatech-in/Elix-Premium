from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import Address, Employee, EmployeeLeave, Profile

if admin.site.is_registered(User):
    admin.site.unregister(User)


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = (
        'username', 'email', 'first_name', 'last_name',
        'user_role_badge', 'is_active', 'is_staff', 'impersonate_action_button'
    )
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'groups')
    actions = ['impersonate_selected_user']

    def user_role_badge(self, obj):
        if obj.is_superuser:
            bg, color, label = '#dc2626', '#ffffff', 'Super Admin'
        else:
            groups = set(obj.groups.values_list('name', flat=True))
            if 'owner' in groups:
                bg, color, label = '#7c3aed', '#ffffff', 'Owner'
            elif 'emp' in groups:
                bg, color, label = '#2563eb', '#ffffff', 'Employee'
            else:
                bg, color, label = '#10b981', '#ffffff', 'Customer'
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">{}</span>',
            bg, color, label
        )
    user_role_badge.short_description = 'Role'

    def impersonate_action_button(self, obj):
        if obj.is_superuser:
            return mark_safe('<span style="color: #9ca3af; font-size: 12px;">(Superadmin)</span>')
        if not obj.is_active:
            return mark_safe('<span style="color: #ef4444; font-size: 12px;">Inactive</span>')

        url = reverse('admin_impersonate_user', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}" style="'
            'background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); '
            'color: #ffffff; padding: 4px 10px; border-radius: 4px; font-weight: 600; '
            'font-size: 11px; text-decoration: none; display: inline-flex; align-items: center; '
            'gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: none;'
            '">'
            '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>'
            'Log In As'
            '</a>',
            url
        )
    impersonate_action_button.short_description = 'Impersonate'

    def impersonate_selected_user(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(request, "Permission denied: Only Super Admins can log in as other users.", level=messages.ERROR)
            return
        if queryset.count() != 1:
            self.message_user(request, "Please select exactly one user to log in as.", level=messages.WARNING)
            return
        target = queryset.first()
        return redirect('admin_impersonate_user', user_id=target.pk)

    impersonate_selected_user.short_description = 'Log In as selected user'

    def render_change_form(self, request, context, add=False, change=False, form_url='', obj=None):
        if obj and not obj.is_superuser and request.user.is_superuser:
            context['impersonate_url'] = reverse('admin_impersonate_user', args=[obj.pk])
            context['can_impersonate'] = True
        return super().render_change_form(request, context, add=add, change=change, form_url=form_url, obj=obj)



@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone')
    search_fields = ('user__email', 'phone')


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('label', 'user', 'pincode', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('label', 'text', 'user__email')


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('get_name', 'get_username', 'status', 'get_phone', 'get_email', 'specialties', 'experience_years', 'rating', 'reviews', 'sort_order')
    list_filter = ('status',)
    list_editable = ('sort_order',)
    search_fields = ('user__first_name', 'user__last_name', 'user__username', 'user__email', 'user__profile__phone', 'specialties')
    raw_id_fields = ('user',)

    def get_name(self, obj):
        return obj.name
    get_name.short_description = 'Name'
    get_name.admin_order_field = 'user__first_name'

    def get_username(self, obj):
        return obj.user.username if obj.user else '—'
    get_username.short_description = 'Username'
    get_username.admin_order_field = 'user__username'

    def get_phone(self, obj):
        return obj.phone
    get_phone.short_description = 'Phone'

    def get_email(self, obj):
        return obj.email
    get_email.short_description = 'Email'


@admin.register(EmployeeLeave)
class EmployeeLeaveAdmin(admin.ModelAdmin):
    list_display = ('employee', 'start_date', 'end_date', 'reason')
    list_filter = ('start_date',)
    search_fields = ('employee__user__first_name', 'employee__user__last_name', 'employee__user__username', 'reason')
