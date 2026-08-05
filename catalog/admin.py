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
    filter_horizontal = ('included_services',)
    inlines = [ServiceVariantInline]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        obj = form.instance
        if obj.kind == 'package' and obj.included_services.exists():
            auto_dur = obj.total_included_duration
            auto_mrp = obj.total_included_mrp
            v = obj.default_variant
            if v:
                if auto_dur > 0:
                    v.duration_mins = auto_dur
                if auto_mrp > 0:
                    v.mrp = auto_mrp
                v.save()


@admin.register(ServiceVariant)
class ServiceVariantAdmin(admin.ModelAdmin):
    list_display = ('service', 'label', 'duration_mins', 'price', 'mrp', 'is_default', 'is_active')
    list_filter = ('is_default', 'is_active')
