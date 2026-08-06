from django.contrib import admin

from .models import Address, Employee, EmployeeLeave, Profile


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
    list_display = ('name', 'status', 'specialties', 'experience_years', 'rating')
    list_filter = ('status',)
    search_fields = ('name', 'email', 'phone', 'specialties')


@admin.register(EmployeeLeave)
class EmployeeLeaveAdmin(admin.ModelAdmin):
    list_display = ('employee', 'start_date', 'end_date', 'reason')
    list_filter = ('start_date',)
    search_fields = ('employee__name', 'reason')
