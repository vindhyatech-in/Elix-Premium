import '../../../core/api/api_config.dart';

/// One hero/carousel slide, regardless of whether it came from the
/// singleton `Hero` row (slide 1) or a `PromoBanner` row (slides 2+) —
/// both collapse to this same shape so `HeroCarousel` doesn't need to
/// know which kind of slide it's rendering.
class CarouselSlide {
  final String title;
  final String subtitle;
  final String ctaLabel;
  final String photo;

  CarouselSlide({required this.title, required this.subtitle, required this.ctaLabel, required this.photo});

  String get photoUrl => resolvePhotoUrl(photo);

  factory CarouselSlide.fromHero(Map<String, dynamic> json) => CarouselSlide(
        title: ((json['headline_lines'] as List?) ?? []).join(' '),
        subtitle: (json['subhead'] as String?) ?? '',
        ctaLabel: (json['primary_cta_label'] as String?) ?? '',
        photo: (json['photo'] as String?) ?? '',
      );

  factory CarouselSlide.fromPromoBanner(Map<String, dynamic> json) => CarouselSlide(
        title: json['title'] as String,
        subtitle: (json['subtitle'] as String?) ?? '',
        ctaLabel: (json['cta_label'] as String?) ?? '',
        photo: (json['photo'] as String?) ?? '',
      );
}

class LandingCategory {
  final String slug;
  final String name;
  final int servicesCount;
  final String photoUrlRaw;
  final String description;

  LandingCategory({required this.slug, required this.name, required this.servicesCount, required this.photoUrlRaw, required this.description});

  String get photoUrl => resolvePhotoUrl(photoUrlRaw);

  factory LandingCategory.fromJson(Map<String, dynamic> json) => LandingCategory(
        slug: json['slug'] as String,
        name: json['name'] as String,
        servicesCount: json['services_count'] as int,
        photoUrlRaw: (json['photo_url'] as String?) ?? '',
        description: (json['description'] as String?) ?? '',
      );
}

class HowItWorksStepData {
  final String step;
  final String title;
  final String body;

  HowItWorksStepData({required this.step, required this.title, required this.body});

  factory HowItWorksStepData.fromJson(Map<String, dynamic> json) => HowItWorksStepData(
        step: json['step'] as String,
        title: json['title'] as String,
        body: (json['body'] as String?) ?? '',
      );
}

class BeforeAfterData {
  final String label;
  final String beforePhoto;
  final String afterPhoto;

  BeforeAfterData({required this.label, required this.beforePhoto, required this.afterPhoto});

  String get beforePhotoUrl => resolvePhotoUrl(beforePhoto);
  String get afterPhotoUrl => resolvePhotoUrl(afterPhoto);

  factory BeforeAfterData.fromJson(Map<String, dynamic> json) => BeforeAfterData(
        label: json['label'] as String,
        beforePhoto: (json['before_photo'] as String?) ?? '',
        afterPhoto: (json['after_photo'] as String?) ?? '',
      );
}

class TestimonialData {
  final String name;
  final String location;
  final int rating;
  final String quote;
  final String service;

  TestimonialData({required this.name, required this.location, required this.rating, required this.quote, required this.service});

  factory TestimonialData.fromJson(Map<String, dynamic> json) => TestimonialData(
        name: json['name'] as String,
        location: (json['location'] as String?) ?? '',
        rating: json['rating'] as int,
        quote: (json['quote'] as String?) ?? '',
        service: (json['service'] as String?) ?? '',
      );
}

/// Public "meet the team" fields only — mirrors the exact subset
/// api/views.py::home_view exposes (never phone/email/face_photo_*).
class BeauticianData {
  final String slug;
  final String name;
  final String specialties;
  final double rating;
  final int reviews;
  final List<String> skills;
  final int experienceYears;
  final String photo;

  BeauticianData({
    required this.slug,
    required this.name,
    required this.specialties,
    required this.rating,
    required this.reviews,
    required this.skills,
    required this.experienceYears,
    required this.photo,
  });

  String get photoUrl => resolvePhotoUrl(photo);

  factory BeauticianData.fromJson(Map<String, dynamic> json) => BeauticianData(
        slug: (json['slug'] as String?) ?? '',
        name: json['name'] as String,
        specialties: (json['specialties'] as String?) ?? '',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        reviews: json['reviews'] as int? ?? 0,
        skills: ((json['skills'] as List?) ?? []).cast<String>(),
        experienceYears: json['experience_years'] as int? ?? 0,
        photo: (json['photo'] as String?) ?? '',
      );
}

class TrustPointData {
  final double value;
  final String suffix;
  final String label;

  TrustPointData({required this.value, required this.suffix, required this.label});

  factory TrustPointData.fromJson(Map<String, dynamic> json) => TrustPointData(
        // Django's DecimalField serializes as a string via
        // DjangoJSONEncoder — parse defensively either way.
        value: double.tryParse('${json['value']}') ?? 0,
        suffix: (json['suffix'] as String?) ?? '',
        label: json['label'] as String,
      );
}

class TrustBadgeData {
  final String title;
  final String body;

  TrustBadgeData({required this.title, required this.body});

  factory TrustBadgeData.fromJson(Map<String, dynamic> json) => TrustBadgeData(
        title: json['title'] as String,
        body: (json['body'] as String?) ?? '',
      );
}

class FaqData {
  final String question;
  final String answer;

  FaqData({required this.question, required this.answer});

  factory FaqData.fromJson(Map<String, dynamic> json) => FaqData(
        question: json['question'] as String,
        answer: (json['answer'] as String?) ?? '',
      );
}

/// Everything GET /api/v1/home/ returns — mirrors
/// core/views.py::index()'s context, minus the booking catalog/gallery
/// items the mobile Home screen doesn't need (packages come from the
/// existing catalog endpoint instead — see CatalogRepository.fetchCatalog).
class HomeContent {
  final CarouselSlide? hero;
  final List<CarouselSlide> promoBanners;
  final List<LandingCategory> categories;
  final List<HowItWorksStepData> howItWorks;
  final List<BeforeAfterData> beforeAfter;
  final List<TestimonialData> testimonials;
  final List<BeauticianData> beauticians;
  final List<TrustPointData> trustPoints;
  final List<TrustBadgeData> trustBadges;
  final List<FaqData> faqs;

  HomeContent({
    required this.hero,
    required this.promoBanners,
    required this.categories,
    required this.howItWorks,
    required this.beforeAfter,
    required this.testimonials,
    required this.beauticians,
    required this.trustPoints,
    required this.trustBadges,
    required this.faqs,
  });

  /// Hero (if any) followed by every active promo banner — exactly what
  /// the carousel widget scrolls through.
  List<CarouselSlide> get slides => [if (hero != null) hero!, ...promoBanners];

  factory HomeContent.fromJson(Map<String, dynamic> json) => HomeContent(
        hero: json['hero'] != null ? CarouselSlide.fromHero(json['hero'] as Map<String, dynamic>) : null,
        promoBanners: ((json['promo_banners'] as List?) ?? [])
            .map((e) => CarouselSlide.fromPromoBanner(e as Map<String, dynamic>))
            .toList(),
        categories: ((json['categories'] as List?) ?? []).map((e) => LandingCategory.fromJson(e as Map<String, dynamic>)).toList(),
        howItWorks: ((json['how_it_works'] as List?) ?? []).map((e) => HowItWorksStepData.fromJson(e as Map<String, dynamic>)).toList(),
        beforeAfter: ((json['before_after'] as List?) ?? []).map((e) => BeforeAfterData.fromJson(e as Map<String, dynamic>)).toList(),
        testimonials: ((json['testimonials'] as List?) ?? []).map((e) => TestimonialData.fromJson(e as Map<String, dynamic>)).toList(),
        beauticians: ((json['beauticians'] as List?) ?? []).map((e) => BeauticianData.fromJson(e as Map<String, dynamic>)).toList(),
        trustPoints: ((json['trust_points'] as List?) ?? []).map((e) => TrustPointData.fromJson(e as Map<String, dynamic>)).toList(),
        trustBadges: ((json['trust_badges'] as List?) ?? []).map((e) => TrustBadgeData.fromJson(e as Map<String, dynamic>)).toList(),
        faqs: ((json['faqs'] as List?) ?? []).map((e) => FaqData.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
