from django.contrib import admin

from .models import Category, Package, Service, ServiceAfterCare, ServiceStep, ServiceVariant


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


class ServiceVariantInline(admin.TabularInline):
    model = ServiceVariant
    extra = 1


class ServiceStepInline(admin.TabularInline):
    model = ServiceStep
    extra = 1
    fields = ('sort_order', 'title', 'badge', 'description', 'image', 'image_url')
    ordering = ('sort_order',)


class ServiceAfterCareInline(admin.StackedInline):
    model = ServiceAfterCare
    extra = 0
    max_num = 1
    can_delete = True
    fields = ('title', 'tips')
    verbose_name = 'After-Care Section'
    verbose_name_plural = 'After-Care Section (Single Box — One tip per line)'


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'popularity_score', 'is_active')
    list_filter = ('category', 'is_active', 'available_today')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ServiceVariantInline, ServiceStepInline, ServiceAfterCareInline]


@admin.register(ServiceAfterCare)
class ServiceAfterCareAdmin(admin.ModelAdmin):
    list_display = ('service', 'title', 'tips_count')
    search_fields = ('service__name', 'title', 'tips')
    autocomplete_fields = ('service',)

    def tips_count(self, obj):
        return len(obj.tips_list)
    tips_count.short_description = 'Number of Tips'


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
