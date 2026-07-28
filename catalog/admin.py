from django.contrib import admin

from .models import Category, Service, ServiceVariant


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'icon')
    prepopulated_fields = {'slug': ('name',)}


class ServiceVariantInline(admin.TabularInline):
    model = ServiceVariant
    extra = 1


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'kind', 'popularity_score', 'is_active')
    list_filter = ('kind', 'category', 'is_active', 'available_today')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ServiceVariantInline]


@admin.register(ServiceVariant)
class ServiceVariantAdmin(admin.ModelAdmin):
    list_display = ('service', 'label', 'duration_mins', 'price', 'mrp', 'is_default', 'is_active')
    list_filter = ('is_default', 'is_active')
