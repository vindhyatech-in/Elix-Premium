"""
Mock content for the landing page.

Every function here stands in for a future REST endpoint. Views call these
functions today; when the API exists, swap the function body for an HTTP
call to the same shape (or move rendering client-side and fetch directly
from templates using the `data-api` attributes already on each section).

Each function's docstring states the endpoint it will be replaced by.
Keeping this in one module (instead of scattering dicts through views.py)
means the day the API ships, this is the only file that changes.
"""


def get_hero():
    """Endpoint: GET /api/v1/hero/  (rarely changes; safe to cache long)"""
    return {
        'eyebrow': 'On-Demand Luxury Beauty',
        'headline_lines': ['Your salon,', 'reimagined at', 'your address.'],
        'subhead': (
            'Verified beauticians. Premium products. Five-star rituals — '
            'delivered to your home, on your schedule.'
        ),
        'primary_cta': {'label': 'Book a Ritual', 'href': '/services-booking/'},
        'secondary_cta': {'label': 'How It Works', 'href': '#how-it-works'},
        'stats': [
            {'value': 50000, 'suffix': '+', 'label': 'Rituals Delivered'},
            {'value': 4.9, 'suffix': '/5', 'label': 'Average Rating'},
            {'value': 120, 'suffix': '+', 'label': 'Cities Soon'},
        ],
        'floating_chips': ['Bridal Makeup', 'Deep Cleanse Facial', 'Keratin Spa', 'Manicure Ritual'],
        'photo': 'images/hero-bg.jpg',
    }


def get_value_pillars():
    """Endpoint: GET /api/v1/value-pillars/"""
    return [
        {
            'index': '01',
            'title': 'Verified, not just listed',
            'body': 'Every beautician passes background verification, skill '
                     'assessment and hygiene certification before they ever '
                     'ring your doorbell.',
            'image': 'verified',
        },
        {
            'index': '02',
            'title': 'Salon-grade, sealed products',
            'body': 'We carry the same professional-grade brands used in '
                     'five-star spas — sealed, single-use where it matters, '
                     'never diluted.',
            'image': 'products',
        },
        {
            'index': '03',
            'title': 'Your space, your schedule',
            'body': 'No commute, no waiting room. Choose a slot between '
                     '7 AM and 10 PM, and your artist arrives fully equipped.',
            'image': 'schedule',
        },
        {
            'index': '04',
            'title': 'Hygiene you can verify',
            'body': 'Tools are sanitised in medical-grade UV kits before '
                     'every appointment, opened in front of you, every time.',
            'image': 'hygiene',
        },
    ]


def get_service_categories():
    """
    Filter pills for Featured Services. Endpoint: GET /api/v1/services/categories/

    Simplified/friendly labels, not a 1:1 mirror of catalog.Category slugs —
    this filter is purely a marketing-page, client-side convenience (see
    featured_services.html's data-category chip matching), independent of
    the real Category model the booking app's catalog uses.
    """
    return ['All', 'Threading', 'Waxing', 'Facial']


def get_featured_services():
    """
    Endpoint: GET /api/v1/services/featured/

    Six real services (added 2026-08-01, replacing the fictional demo set)
    picked to span the real catalog's categories — ids match `Service.slug`
    in the `catalog` app exactly, since "Book Now" writes these ids straight
    into the booking cart (see developed.md "Marketing → Booking cart
    handoff" and "Real catalog data"). `rating` is intentionally `None` —
    no fabricated ratings for a real business; featured_services.html hides
    the star badge when falsy.
    """
    return [
        {
            'id': 'threading-full-face-with-eyebrows',
            'category': 'Threading',
            'name': 'Full Face Threading (With Eyebrows)',
            'description': 'Precision threading for a clean, defined look — brows included.',
            'duration': '25 min',
            'price': 239,
            'rating': None,
            'tone': 'blush',
            'photo': 'images/portfolio-5.jpg',
        },
        {
            'id': 'peel-off-wax-full-face',
            'category': 'Waxing',
            'name': 'Full Face Peel-Off Wax',
            'description': 'Gentle peel-off wax for smooth, hair-free skin all over the face.',
            'duration': '35 min',
            'price': 389,
            'rating': None,
            'tone': 'rose',
            'photo': 'images/portfolio-3.jpg',
        },
        {
            'id': 'body-wax-full-legs',
            'category': 'Waxing',
            'name': 'Full Legs Wax',
            'description': 'Full-leg waxing with your choice of wax type, done at home.',
            'duration': '45 min',
            'price': 349,
            'rating': None,
            'tone': 'espresso',
            'photo': 'images/service-massage.jpg',
        },
        {
            'id': 'body-wax-full-body',
            'category': 'Waxing',
            'name': 'Full Body Wax',
            'description': 'Complete full-body waxing ritual, from arms to legs to back.',
            'duration': '90 min',
            'price': 1100,
            'rating': None,
            'tone': 'espresso',
            'photo': 'images/service-massage.jpg',
        },
        {
            'id': 'facial-glow-vitamin-c',
            'category': 'Facial',
            'name': 'Glow Facial Vitamin C',
            'description': 'Instant glow, nourishes & improves radiance.',
            'duration': '70 min',
            'price': 1249,
            'rating': None,
            'tone': 'blush',
            'photo': 'images/service-facial.jpg',
        },
        {
            'id': 'facial-o3-bridal',
            'category': 'Facial',
            'name': 'O3 Bridal Facial (Vitamin C)',
            'description': 'Instant bridal glow, brightens skin — for your big day.',
            'duration': '85 min',
            'price': 2189,
            'rating': None,
            'tone': 'gold',
            'photo': 'images/compare-facial-after.jpg',
        },
    ]


def get_packages():
    """Endpoint: GET /api/v1/packages/"""
    return [
        {
            'id': 'essential',
            'name': 'Essential',
            'tagline': 'A perfect first ritual',
            'price': 1999,
            'period': 'per visit',
            'featured': False,
            'features': [
                'Choice of 1 signature service',
                'Certified beautician',
                'Premium sealed products',
                'Free rescheduling',
            ],
        },
        {
            'id': 'signature',
            'name': 'Signature',
            'tagline': 'Our most-loved ritual',
            'price': 4499,
            'period': 'per visit',
            'featured': True,
            'features': [
                'Any 3 services, bundled',
                'Senior beautician, your choice',
                'Premium + organic product line',
                'Free rescheduling & priority slots',
                'Complimentary skin/hair consult',
            ],
        },
        {
            'id': 'indulgence',
            'name': 'Indulgence',
            'tagline': 'The full spa experience',
            'price': 8999,
            'period': 'per visit',
            'featured': False,
            'features': [
                'Full-day multi-service ritual',
                'Two dedicated specialists',
                'Luxury imported product line',
                'Dedicated concierge support',
                'Complimentary touch-up visit',
            ],
        },
    ]


def get_how_it_works():
    """Endpoint: GET /api/v1/how-it-works/"""
    return [
        {
            'step': '01',
            'title': 'Choose your ritual',
            'body': 'Browse services, pick a package, and select a time that fits your day.',
            'icon': 'select',
        },
        {
            'step': '02',
            'title': 'We verify & match',
            'body': 'A vetted specialist matching your service is assigned and confirmed.',
            'icon': 'match',
        },
        {
            'step': '03',
            'title': 'Artist arrives, equipped',
            'body': 'Confirm your artist with an OTP and live face verification, then '
                     'watch tools sanitised and sealed products opened in front of you.',
            'icon': 'arrive',
        },
        {
            'step': '04',
            'title': 'Relax through the ritual',
            'body': 'Your space becomes the studio. Sit back — we bring the salon to you.',
            'icon': 'ritual',
        },
        {
            'step': '05',
            'title': 'Rate & rebook in a tap',
            'body': 'Share feedback, save your favourite artist, and rebook effortlessly.',
            'icon': 'rebook',
        },
    ]


def get_trust_points():
    """Endpoint: GET /api/v1/trust/"""
    return [
        {'value': 12000, 'suffix': '+', 'label': 'Verified Beauticians', 'icon': 'badge'},
        {'value': 4.9, 'suffix': '/5', 'label': 'Customer Rating', 'icon': 'star'},
        {'value': 50000, 'suffix': '+', 'label': 'Rituals Completed', 'icon': 'sparkle'},
        {'value': 100, 'suffix': '%', 'label': 'Sealed Product Guarantee', 'icon': 'shield'},
    ]


def get_trust_badges():
    """Endpoint: GET /api/v1/trust/badges/"""
    return [
        {
            'title': 'Identity Verified',
            'body': 'Government ID and address verification for every beautician, '
                     'plus an OTP and live face verification before they start '
                     'your service.',
        },
        {
            'title': 'Experience Assessed',
            'body': 'Hands-on skill tests conducted by senior in-house artists.',
        },
        {
            'title': 'Hygiene Certified',
            'body': 'UV-sanitised tools, sealed products, opened in front of you.',
        },
        {
            'title': 'Quality Products',
            'body': 'Only professional, dermatologically tested product lines.',
        },
        {
            'title': '24/7 Support',
            'body': 'A real concierge team, reachable before, during and after.',
        },
    ]


def get_beauticians():
    """Endpoint: GET /api/v1/beauticians/"""
    return [
        {
            'id': 'anita-r',
            'name': 'Anita R.',
            'specialty': 'Bridal Makeup Artist',
            'experience': '9 yrs experience',
            'rating': 5.0,
            'reviews': 812,
            'skills': ['HD Makeup', 'Airbrush', 'Draping'],
            'photo': 'images/artist-1.jpg',
        },
        {
            'id': 'sofia-m',
            'name': 'Sofia M.',
            'specialty': 'Senior Hair Stylist',
            'experience': '7 yrs experience',
            'rating': 4.9,
            'reviews': 634,
            'skills': ['Keratin', 'Colour', 'Styling'],
            'photo': 'images/artist-2.jpg',
        },
        {
            'id': 'kavya-n',
            'name': 'Kavya N.',
            'specialty': 'Skin & Facial Expert',
            'experience': '6 yrs experience',
            'rating': 4.9,
            'reviews': 501,
            'skills': ['Dermat Facials', 'Peels', 'LED Therapy'],
            'photo': 'images/artist-3.jpg',
        },
        {
            'id': 'meera-k',
            'name': 'Meera K.',
            'specialty': 'Spa Therapist',
            'experience': '8 yrs experience',
            'rating': 4.8,
            'reviews': 447,
            'skills': ['Deep Tissue', 'Aromatherapy', 'Reflexology'],
            'photo': 'images/artist-4.jpg',
        },
    ]


def get_testimonials():
    """Endpoint: GET /api/v1/testimonials/"""
    return [
        {
            'name': 'Ritika Malhotra',
            'location': 'Bengaluru',
            'rating': 5,
            'quote': (
                'It genuinely felt like a five-star spa walked into my living '
                'room. The artist carried everything, and my skin has never '
                'looked better.'
            ),
            'service': 'Radiance Glow Facial',
        },
        {
            'name': 'Ayesha Khan',
            'location': 'Hyderabad',
            'rating': 5,
            'quote': (
                'Booked my bridal trial at 9 PM after work — the team matched '
                'me with an artist within minutes. Wedding day makeup lasted '
                '14 hours, zero touch-ups.'
            ),
            'service': 'Editorial Bridal Makeup',
        },
        {
            'name': 'Neha Kapoor',
            'location': 'Mumbai',
            'rating': 5,
            'quote': (
                'The hygiene protocol sold me — watching them unseal every '
                'tool before starting made me trust this immediately.'
            ),
            'service': 'Signature Hair Spa',
        },
        {
            'name': 'Priya Sharma',
            'location': 'Delhi NCR',
            'rating': 4,
            'quote': (
                'Rebooked three times this month. Same artist, same quality, '
                'and I never have to leave the house.'
            ),
            'service': 'Gel Luxe Manicure',
        },
    ]


def get_gallery():
    """Endpoint: GET /api/v1/gallery/"""
    return {
        'before_after': [
            {
                'label': 'Keratin Smoothing', 'tone': 'espresso',
                'before_photo': 'images/compare-hair-before.jpg',
                'after_photo': 'images/compare-hair-after.jpg',
            },
            {
                'label': 'Radiance Facial', 'tone': 'blush',
                'before_photo': 'images/compare-facial-before.jpg',
                'after_photo': 'images/compare-facial-after.jpg',
            },
            {
                'label': 'Bridal Transformation', 'tone': 'gold',
                'before_photo': 'images/compare-bridal-before.jpg',
                'after_photo': 'images/compare-bridal-after.jpg',
            },
        ],
        'portfolio': [
            {'label': 'Editorial Makeup', 'tone': 'gold', 'photo': 'images/portfolio-1.jpg'},
            {'label': 'Hair Colour', 'tone': 'rose', 'photo': 'images/portfolio-2.jpg'},
            {'label': 'Nail Art', 'tone': 'blush', 'photo': 'images/portfolio-3.jpg'},
            {'label': 'Spa Ritual', 'tone': 'espresso', 'photo': 'images/portfolio-4.jpg'},
            {'label': 'Skin Therapy', 'tone': 'blush', 'photo': 'images/portfolio-5.jpg'},
            {'label': 'Bridal Look', 'tone': 'gold', 'photo': 'images/portfolio-6.jpg'},
        ],
    }


def get_beauty_tips():
    """Endpoint: GET /api/v1/blogs/  (or /api/v1/beauty-tips/)"""
    return [
        {
            'id': 'monsoon-hair-care',
            'category': 'Hair Care',
            'title': 'The 5-Step Monsoon Hair Ritual Dermatologists Swear By',
            'excerpt': 'Humidity-proof your strands with this professional routine.',
            'read_time': '4 min read',
            'date': 'Jul 12, 2026',
            'photo': 'images/tip-hair-care.jpg',
        },
        {
            'id': 'bridal-skin-timeline',
            'category': 'Skin',
            'title': 'Your Bridal Skin Timeline: What to Do 90, 30 and 7 Days Out',
            'excerpt': 'A week-by-week glow plan used by our senior facialists.',
            'read_time': '6 min read',
            'date': 'Jul 05, 2026',
            'photo': 'images/tip-bridal-skin.jpg',
        },
        {
            'id': 'gel-vs-regular',
            'category': 'Nails',
            'title': 'Gel vs. Regular Manicure: What Actually Lasts Longer',
            'excerpt': 'We asked 30 nail artists — here is the honest verdict.',
            'read_time': '3 min read',
            'date': 'Jun 28, 2026',
            'photo': 'images/tip-nails.jpg',
        },
    ]


def get_faqs():
    """Endpoint: GET /api/v1/faqs/"""
    return [
        {
            'question': 'How are beauticians verified?',
            'answer': (
                'Every professional undergoes ID verification, background '
                'checks, a hands-on skill assessment, and hygiene training '
                'before joining the platform — and is re-audited quarterly.'
            ),
        },
        {
            'question': 'What products do you use?',
            'answer': (
                'We use professional, salon-grade and dermatologically '
                'tested product lines. Single-use items are sealed and '
                'opened in front of you at the start of your appointment.'
            ),
        },
        {
            'question': 'Can I reschedule or cancel a booking?',
            'answer': (
                'Yes — free rescheduling up to 4 hours before your slot. '
                'Cancellations are fully refunded when made 12+ hours ahead.'
            ),
        },
        {
            'question': 'Which cities do you currently serve?',
            'answer': (
                'We are live in 25+ major Indian metros and expanding to '
                '120+ cities this year. Enter your pincode at checkout to confirm.'
            ),
        },
        {
            'question': 'Is there a hygiene guarantee?',
            'answer': (
                'Yes. Tools are sanitised in medical-grade UV kits and every '
                'sealed product is opened only in front of the customer.'
            ),
        },
    ]
