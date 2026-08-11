from django.contrib import admin

from .models import Category, Package, Service, ServiceVariant


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


class ServiceVariantInline(admin.TabularInline):
    model = ServiceVariant
    extra = 1


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'popularity_score', 'is_active')
    list_filter = ('category', 'is_active', 'available_today')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ServiceVariantInline]


@admin.register(ServiceVariant)
class ServiceVariantAdmin(admin.ModelAdmin):
    list_display = ('service', 'label', 'duration_mins', 'price', 'mrp', 'is_default', 'is_active')
    list_filter = ('is_default', 'is_active')


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'price', 'mrp', 'popularity_score', 'is_active')
    list_filter = ('category', 'is_active', 'available_today')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ('included_services',)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        obj = form.instance
        if obj.included_services.exists():
            auto_dur = obj.total_included_duration
            auto_mrp = obj.total_included_mrp
            update_fields = []
            if auto_dur > 0:
                obj.duration_mins = auto_dur
                update_fields.append('duration_mins')
            if auto_mrp > 0:
                obj.mrp = auto_mrp
                update_fields.append('mrp')
            if update_fields:
                obj.save(update_fields=update_fields)
