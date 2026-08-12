import '../../features/catalog/models/catalog_item.dart';
import 'api_client.dart';

class Offer {
  final String code;
  final String title;
  final String description;
  Offer({required this.code, required this.title, required this.description});

  factory Offer.fromJson(Map<String, dynamic> json) => Offer(
        code: json['code'] as String,
        title: json['title'] as String,
        description: json['description'] as String,
      );
}

/// Public, unauthenticated catalog data — GET /api/v1/categories/,
/// /api/v1/catalog/, /api/v1/offers/ (see api/views.py).
class CatalogRepository {
  final ApiClient _client;
  CatalogRepository([ApiClient? client]) : _client = client ?? const ApiClient();

  Future<List<CatalogCategory>> fetchCategories() async {
    final body = await _client.get('/api/v1/categories/');
    return ((body['categories'] as List?) ?? [])
        .map((e) => CatalogCategory.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<CatalogItem>> fetchCatalog({String? kind}) async {
    final body = await _client.get('/api/v1/catalog/', query: kind != null ? {'kind': kind} : null);
    return ((body['catalog'] as List?) ?? [])
        .map((e) => CatalogItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Offer>> fetchOffers() async {
    final body = await _client.get('/api/v1/offers/');
    return ((body['offers'] as List?) ?? []).map((e) => Offer.fromJson(e as Map<String, dynamic>)).toList();
  }
}
