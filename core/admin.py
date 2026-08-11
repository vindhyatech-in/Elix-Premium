from django.contrib import admin

from .models import (
    FAQ, BeautyTip, GalleryBeforeAfter, GalleryPortfolioItem,
    Hero, HowItWorksStep, SiteNotification, Testimonial, TrendingSearch,
    TrustBadge, TrustPoint, ValuePillar,
)


@admin.register(Hero)
class HeroAdmin(admin.ModelAdmin):
    list_display = ('eyebrow', 'is_active')


@admin.register(ValuePillar)
class ValuePillarAdmin(admin.ModelAdmin):
    list_display = ('index', 'title', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(HowItWorksStep)
class HowItWorksStepAdmin(admin.ModelAdmin):
    list_display = ('step', 'title', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(TrustPoint)
class TrustPointAdmin(admin.ModelAdmin):
    list_display = ('label', 'value', 'suffix', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(TrustBadge)
class TrustBadgeAdmin(admin.ModelAdmin):
    list_display = ('title', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ('name', 'service', 'rating', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(GalleryBeforeAfter)
class GalleryBeforeAfterAdmin(admin.ModelAdmin):
    list_display = ('label', 'tone', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(GalleryPortfolioItem)
class GalleryPortfolioItemAdmin(admin.ModelAdmin):
    list_display = ('label', 'tone', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(BeautyTip)
class BeautyTipAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'date', 'sort_order')
    list_editable = ('sort_order',)
    prepopulated_fields = {'slug': ('title',)}


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ('question', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(SiteNotification)
class SiteNotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'time_label', 'read', 'sort_order')
    list_editable = ('sort_order',)


@admin.register(TrendingSearch)
class TrendingSearchAdmin(admin.ModelAdmin):
    list_display = ('term', 'sort_order')
    list_editable = ('sort_order',)
