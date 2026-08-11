from django.http import JsonResponse
from catalog.models import Category, Service

INDORE_PINCODES = {
    '452001', '452002', '452003', '452004', '452005', '452006', '452007',
    '452008', '452009', '452010', '452011', '452012', '452013', '452014',
    '452015', '452016', '452018', '452020', '453771'
}

def verify_serviceability(request):
    """Check if location pincode is within serviceable area (Indore, MP)."""
    pincode = request.GET.get('pincode', '').strip()
    city = request.GET.get('city', '').strip().lower()
    
    is_serviceable = (pincode in INDORE_PINCODES) or ('indore' in city)
    
    return JsonResponse({
        'status': 'success',
        'city': 'Indore',
        'pincode': pincode,
        'is_serviceable': is_serviceable,
        'urgent_service_available': is_serviceable,
        'urgent_eta_minutes': 50 if is_serviceable else None,
        'message': 'Serviceable in Indore, MP! Urgent 50-min service available.' if is_serviceable else 'Sorry, currently we only service inside Indore, MP.'
    })

def get_categories(request):
    """Get active catalog categories."""
    categories = Category.objects.all().values('id', 'slug', 'name')
    return JsonResponse({'status': 'success', 'categories': list(categories)})

def get_services(request):
    """Get services list with 50-min express flag."""
    services = Service.objects.filter(is_active=True).prefetch_related('variants')
    data = []
    for s in services:
        variants = list(s.variants.values('id', 'name', 'price', 'duration_minutes', 'is_default'))
        data.append({
            'id': s.id,
            'slug': s.slug,
            'name': s.name,
            'category_id': s.category_id,
            'description': s.description,
            'photo': s.photo,
            'rating': float(s.rating),
            'reviews_count': s.reviews_count,
            'badges': s.badges,
            'urgent_50min_eligible': True,
            'variants': variants
        })
    return JsonResponse({'status': 'success', 'services': data})
