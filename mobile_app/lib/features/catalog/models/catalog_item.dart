import '../../../core/api/api_config.dart';

/// One priced option of a `Service` — a `Package` has none of these
/// (it's priced directly), so [CatalogItem.variants] is always empty
/// for a package. Mirrors core/booking_data.py::_catalog_entry's
/// `variants` list.
class CatalogVariant {
  final int id;
  final String label;
  final double price;
  final double? mrp;
  final int durationMins;
  final String durationLabel;
  final int? discountPct;
  final bool isDefault;

  CatalogVariant({
    required this.id,
    required this.label,
    required this.price,
    required this.mrp,
    required this.durationMins,
    required this.durationLabel,
    required this.discountPct,
    required this.isDefault,
  });

  factory CatalogVariant.fromJson(Map<String, dynamic> json) => CatalogVariant(
        id: json['id'] as int,
        label: (json['label'] as String?) ?? '',
        price: (json['price'] as num).toDouble(),
        mrp: (json['mrp'] as num?)?.toDouble(),
        durationMins: json['duration_mins'] as int,
        durationLabel: (json['duration_label'] as String?) ?? '',
        discountPct: json['discount_pct'] as int?,
        isDefault: json['is_default'] as bool? ?? false,
      );
}

/// One service included inside a `Package`, with its own selectable
/// variants — mirrors `_catalog_entry`'s `included_services` list.
class IncludedService {
  final int id;
  final String name;
  final String photo;
  final int selectedVariantId;
  final double price;
  final int durationMins;
  final String durationLabel;
  final List<CatalogVariant> variants;

  IncludedService({
    required this.id,
    required this.name,
    required this.photo,
    required this.selectedVariantId,
    required this.price,
    required this.durationMins,
    required this.durationLabel,
    required this.variants,
  });

  String get photoUrl => photo.startsWith('http') ? photo : '${ApiConfig.baseUrl}$photo';

  factory IncludedService.fromJson(Map<String, dynamic> json) => IncludedService(
        id: json['id'] as int,
        name: json['name'] as String,
        photo: (json['photo'] as String?) ?? '',
        selectedVariantId: json['selected_variant_id'] as int,
        price: (json['price'] as num).toDouble(),
        durationMins: json['duration_mins'] as int,
        durationLabel: (json['duration_label'] as String?) ?? '',
        variants: ((json['variants'] as List?) ?? [])
            .map((v) => CatalogVariant.fromJson({...v as Map<String, dynamic>, 'is_default': v['id'] == json['selected_variant_id']}))
            .toList(),
      );
}

/// A single service or package — mirrors the exact JSON shape
/// `GET /api/v1/catalog/` returns (core/booking_data.py::get_booking_catalog),
/// the same one the web app's catalog cards render from.
class CatalogItem {
  final String id; // slug
  final String kind; // 'service' | 'package'
  final String category; // category slug
  final String name;
  final String description;
  final int durationMins;
  final double price;
  final double? mrp;
  final double rating;
  final int reviewsCount;
  final int popularityScore;
  final List<String> badges;
  final bool availableToday;
  final String photo;
  final int? discountPct;
  final String durationLabel;
  final List<IncludedService> includedServices;
  final List<CatalogVariant> variants;

  CatalogItem({
    required this.id,
    required this.kind,
    required this.category,
    required this.name,
    required this.description,
    required this.durationMins,
    required this.price,
    required this.mrp,
    required this.rating,
    required this.reviewsCount,
    required this.popularityScore,
    required this.badges,
    required this.availableToday,
    required this.photo,
    required this.discountPct,
    required this.durationLabel,
    required this.includedServices,
    required this.variants,
  });

  bool get isPackage => kind == 'package';
  String get photoUrl => photo.startsWith('http') ? photo : '${ApiConfig.baseUrl}$photo';

  factory CatalogItem.fromJson(Map<String, dynamic> json) => CatalogItem(
        id: json['id'] as String,
        kind: json['kind'] as String,
        category: json['category'] as String,
        name: json['name'] as String,
        description: (json['description'] as String?) ?? '',
        durationMins: json['duration_mins'] as int,
        price: (json['price'] as num).toDouble(),
        mrp: (json['mrp'] as num?)?.toDouble(),
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        reviewsCount: json['reviews_count'] as int? ?? 0,
        popularityScore: json['popularity_score'] as int? ?? 0,
        badges: ((json['badges'] as List?) ?? []).cast<String>(),
        availableToday: json['available_today'] as bool? ?? true,
        photo: (json['photo'] as String?) ?? '',
        discountPct: json['discount_pct'] as int?,
        durationLabel: (json['duration_label'] as String?) ?? '',
        includedServices: ((json['included_services'] as List?) ?? [])
            .map((e) => IncludedService.fromJson(e as Map<String, dynamic>))
            .toList(),
        variants: ((json['variants'] as List?) ?? [])
            .map((e) => CatalogVariant.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class CatalogCategory {
  final int id;
  final String slug;
  final String name;

  CatalogCategory({required this.id, required this.slug, required this.name});

  factory CatalogCategory.fromJson(Map<String, dynamic> json) => CatalogCategory(
        id: json['id'] as int,
        slug: json['slug'] as String,
        name: json['name'] as String,
      );
}
