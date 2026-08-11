from datetime import date

from django.db import migrations


def seed_site_content(apps, schema_editor):
    """One-time seed moving mock_data.py's/booking_data.py's hardcoded
    marketing content into real rows — see developed.md 'Marketing
    content moved off mock_data.py, DB engine made per-environment'."""
    Hero = apps.get_model('core', 'Hero')
    ValuePillar = apps.get_model('core', 'ValuePillar')
    HowItWorksStep = apps.get_model('core', 'HowItWorksStep')
    TrustPoint = apps.get_model('core', 'TrustPoint')
    TrustBadge = apps.get_model('core', 'TrustBadge')
    Beautician = apps.get_model('core', 'Beautician')
    Testimonial = apps.get_model('core', 'Testimonial')
    GalleryBeforeAfter = apps.get_model('core', 'GalleryBeforeAfter')
    GalleryPortfolioItem = apps.get_model('core', 'GalleryPortfolioItem')
    BeautyTip = apps.get_model('core', 'BeautyTip')
    FAQ = apps.get_model('core', 'FAQ')
    SiteNotification = apps.get_model('core', 'SiteNotification')
    TrendingSearch = apps.get_model('core', 'TrendingSearch')

    Hero.objects.create(
        eyebrow='✨ LUXURY SALON AT HOME',
        headline_lines=['Premium Salon', 'at Home.'],
        subhead='Certified female experts. Sealed single-use products. Delivered in 50 minutes.',
        primary_cta_label='Book Now →', primary_cta_href='/booking/',
        secondary_cta_label='Explore Packages', secondary_cta_href='/booking/?category=package',
        stats=[
            {'value': 50000, 'suffix': '+', 'label': 'Rituals Delivered'},
            {'value': 4.9, 'suffix': '/5', 'label': 'Average Rating'},
            {'value': 25, 'suffix': '+', 'label': 'Areas Covered in Indore'},
        ],
        floating_chips=['Threading', 'Body Wax', 'Facials', 'Packages'],
        photo='images/hero-bg.jpg', is_active=True,
    )

    for i, (title, body, image) in enumerate([
        ('Verified, not just listed', 'Every beautician passes background verification, skill assessment and hygiene certification before they ever ring your doorbell.', 'verified'),
        ('Salon-grade, sealed products', 'We carry the same professional-grade brands used in five-star spas — sealed, single-use where it matters, never diluted.', 'products'),
        ('Your space, your schedule', 'No commute, no waiting room. Choose a slot between 7 AM and 10 PM, and your artist arrives fully equipped.', 'schedule'),
        ('Hygiene you can verify', 'Tools are sanitised in medical-grade UV kits before every appointment, opened in front of you, every time.', 'hygiene'),
    ]):
        ValuePillar.objects.create(index=f'{i + 1:02d}', title=title, body=body, image=image, sort_order=i)

    for i, (title, body, icon) in enumerate([
        ('Choose your ritual', 'Browse services, pick a package, and select a time that fits your day.', 'select'),
        ('We verify & match', 'A vetted specialist matching your service is assigned and confirmed.', 'match'),
        ('Artist arrives, equipped', 'Confirm your artist with an OTP and live face verification, then watch tools sanitised and sealed products opened in front of you.', 'arrive'),
        ('Relax through the ritual', 'Your space becomes the studio. Sit back — we bring the salon to you.', 'ritual'),
        ('Rate & rebook in a tap', 'Share feedback, save your favourite artist, and rebook effortlessly.', 'rebook'),
    ]):
        HowItWorksStep.objects.create(step=f'{i + 1:02d}', title=title, body=body, icon=icon, sort_order=i)

    for i, (value, suffix, label, icon) in enumerate([
        (12000, '+', 'Verified Beauticians', 'badge'),
        (4.9, '/5', 'Customer Rating', 'star'),
        (50000, '+', 'Rituals Completed', 'sparkle'),
        (100, '%', 'Sealed Product Guarantee', 'shield'),
    ]):
        TrustPoint.objects.create(value=value, suffix=suffix, label=label, icon=icon, sort_order=i)

    for i, (title, body) in enumerate([
        ('Identity Verified', 'Government ID and address verification for every beautician, plus an OTP and live face verification before they start your service.'),
        ('Experience Assessed', 'Hands-on skill tests conducted by senior in-house artists.'),
        ('Hygiene Certified', 'UV-sanitised tools, sealed products, opened in front of you.'),
        ('Quality Products', 'Only professional, dermatologically tested product lines.'),
        ('24/7 Support', 'A real concierge team, reachable before, during and after.'),
    ]):
        TrustBadge.objects.create(title=title, body=body, sort_order=i)

    for i, (slug, name, specialty, experience, rating, reviews, skills, photo) in enumerate([
        ('anita-r', 'Anita R.', 'Waxing & Threading Specialist', '9 yrs experience', 5.0, 812, ['Threading', 'Honey Wax', 'Rica Wax'], 'images/artist-1.jpg'),
        ('sofia-m', 'Sofia M.', 'Senior Hair Stylist', '7 yrs experience', 4.9, 634, ['Keratin', 'Colour', 'Styling'], 'images/artist-2.jpg'),
        ('kavya-n', 'Kavya N.', 'Skin & Facial Expert', '6 yrs experience', 4.9, 501, ['Dermat Facials', 'Peels', 'LED Therapy'], 'images/artist-3.jpg'),
        ('meera-k', 'Meera K.', 'Spa Therapist', '8 yrs experience', 4.8, 447, ['Deep Tissue', 'Aromatherapy', 'Reflexology'], 'images/artist-4.jpg'),
    ]):
        Beautician.objects.create(
            slug=slug, name=name, specialty=specialty, experience=experience,
            rating=rating, reviews=reviews, skills=skills, photo=photo, sort_order=i,
        )

    for i, (name, location, rating, quote, service) in enumerate([
        ('Ritika Malhotra', 'Vijay Nagar, Indore', 5, 'It genuinely felt like a five-star spa walked into my living room. The artist carried everything, and my skin has never looked better.', 'Radiance Glow Facial'),
        ('Ayesha Khan', 'Palasia, Indore', 5, 'Booked a late-evening waxing appointment after work — the team matched me with an artist within minutes. Clean, quick, and the hygiene kit was sealed right in front of me.', 'Full Body Wax'),
        ('Neha Kapoor', 'Rajwada, Indore', 5, 'The hygiene protocol sold me — watching them unseal every tool before starting made me trust this immediately.', 'Signature Hair Spa'),
        ('Priya Sharma', 'Bhawarkuan, Indore', 4, 'Rebooked three times this month. Same artist, same quality, and I never have to leave the house.', 'Gel Luxe Manicure'),
    ]):
        Testimonial.objects.create(name=name, location=location, rating=rating, quote=quote, service=service, sort_order=i)

    for i, (label, tone, before_photo, after_photo) in enumerate([
        ('Keratin Smoothing', 'espresso', 'images/compare-hair-before.jpg', 'images/compare-hair-after.jpg'),
        ('Radiance Facial', 'blush', 'images/compare-facial-before.jpg', 'images/compare-facial-after.jpg'),
    ]):
        GalleryBeforeAfter.objects.create(label=label, tone=tone, before_photo=before_photo, after_photo=after_photo, sort_order=i)

    for i, (label, tone, photo) in enumerate([
        ('Editorial Makeup', 'gold', 'images/portfolio-1.jpg'),
        ('Hair Colour', 'rose', 'images/portfolio-2.jpg'),
        ('Nail Art', 'blush', 'images/portfolio-3.jpg'),
        ('Spa Ritual', 'espresso', 'images/portfolio-4.jpg'),
        ('Skin Therapy', 'blush', 'images/portfolio-5.jpg'),
        ('Combo Package Glow-Up', 'gold', 'images/portfolio-6.jpg'),
    ]):
        GalleryPortfolioItem.objects.create(label=label, tone=tone, photo=photo, sort_order=i)

    for i, (slug, category, title, excerpt, read_time, tip_date, photo) in enumerate([
        ('monsoon-hair-care', 'Hair Care', 'The 5-Step Monsoon Hair Ritual Dermatologists Swear By', 'Humidity-proof your strands with this professional routine.', '4 min read', date(2026, 7, 12), 'images/tip-hair-care.jpg'),
        ('facial-frequency-guide', 'Skin', 'How Often You Should Really Get a Facial, By Skin Type', 'A simple monthly cadence used by our senior facialists.', '5 min read', date(2026, 7, 5), 'images/service-facial.jpg'),
        ('gel-vs-regular', 'Nails', 'Gel vs. Regular Manicure: What Actually Lasts Longer', 'We asked 30 nail artists — here is the honest verdict.', '3 min read', date(2026, 6, 28), 'images/tip-nails.jpg'),
    ]):
        BeautyTip.objects.create(slug=slug, category=category, title=title, excerpt=excerpt, read_time=read_time, date=tip_date, photo=photo, sort_order=i)

    for i, (question, answer) in enumerate([
        ('How are beauticians verified?', 'Every professional undergoes ID verification, background checks, a hands-on skill assessment, and hygiene training before joining the platform — and is re-audited quarterly.'),
        ('What products do you use?', 'We use professional, salon-grade and dermatologically tested product lines. Single-use items are sealed and opened in front of you at the start of your appointment.'),
        ('Can I reschedule or cancel a booking?', 'Yes — free rescheduling up to 4 hours before your slot. Cancellations are fully refunded when made 12+ hours ahead.'),
        ('Which cities do you currently serve?', 'We are currently live only in Indore. Enter your pincode at checkout to confirm we cover your area — we are expanding to more cities soon.'),
        ('Is there a hygiene guarantee?', 'Yes. Tools are sanitised in medical-grade UV kits and every sealed product is opened only in front of the customer.'),
    ]):
        FAQ.objects.create(question=question, answer=answer, sort_order=i)

    for i, (title, body, time_label, icon, read) in enumerate([
        ('Booking confirmed', 'Your Signature Hair Spa is confirmed for tomorrow, 11 AM.', '2h ago', 'check', False),
        ('Limited slots left', 'Keratin Smoothing has only 3 weekend slots remaining in your area.', '1d ago', 'clock', False),
        ('New offer for you', 'Use WEEKDAY15 for 15% off your next Monday-Thursday booking.', '3d ago', 'tag', True),
    ]):
        SiteNotification.objects.create(title=title, body=body, time_label=time_label, icon=icon, read=read, sort_order=i)

    for i, term in enumerate(['Full Body Wax', 'Keratin Smoothing', 'Deep Cleanse Facial', 'Head Massage', 'Gel Manicure']):
        TrendingSearch.objects.create(term=term, sort_order=i)


def noop_reverse(apps, schema_editor):
    """Not reversible — deleting by content match rather than PK isn't
    worth the complexity for a one-time seed migration."""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_site_content, noop_reverse),
    ]
