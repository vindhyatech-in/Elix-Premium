import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/catalog/models/catalog_item.dart';

/// Package pricing when the customer swaps an included service's
/// default variant for another one — mirrors
/// bookings.views._resolve_cart_pricing's `any_customized` branch
/// exactly (proportional total, package's own discount % preserved)
/// so the cart's live estimate never disagrees with what checkout
/// actually charges.
class PackagePricing {
  final double price;
  final double mrp;
  final int durationMins;
  PackagePricing({required this.price, required this.mrp, required this.durationMins});
}

PackagePricing computePackagePricing(CatalogItem item, Map<int, int> includedSelections) {
  if (includedSelections.isEmpty) {
    return PackagePricing(price: item.price, mrp: item.mrp ?? item.price, durationMins: item.durationMins);
  }
  double totalMrp = 0;
  int totalDuration = 0;
  for (final inc in item.includedServices) {
    final chosenId = includedSelections[inc.id] ?? inc.selectedVariantId;
    final variant = inc.variants.firstWhere(
      (v) => v.id == chosenId,
      orElse: () => inc.variants.firstWhere((v) => v.id == inc.selectedVariantId, orElse: () => inc.variants.first),
    );
    totalMrp += variant.price;
    totalDuration += variant.durationMins;
  }
  final discountPct = item.discountPct ?? 0;
  final price = discountPct > 0 ? totalMrp * (100 - discountPct) / 100 : totalMrp;
  return PackagePricing(price: price, mrp: totalMrp, durationMins: totalDuration);
}

/// One cart line — [variantId] only applies to a `Service` with more
/// than one variant; [includedSelections] (serviceId -> chosen
/// variantId) only applies to a `Package`. Both null/empty means "use
/// the item's own default pricing", same as the web's `booking.js` cart.
class CartLine {
  final CatalogItem item;
  int qty;
  int? variantId;
  Map<int, int> includedSelections;

  CartLine({required this.item, this.qty = 1, this.variantId, Map<int, int>? includedSelections})
      : includedSelections = includedSelections ?? {};

  double get unitPrice {
    if (item.isPackage) {
      return computePackagePricing(item, includedSelections).price;
    }
    if (variantId != null) {
      final v = item.variants.where((v) => v.id == variantId).toList();
      if (v.isNotEmpty) return v.first.price;
    }
    return item.price;
  }

  double get lineTotal => unitPrice * qty;

  Map<String, dynamic> toCartPayload() => {
        'id': item.id,
        'qty': qty,
        if (variantId != null) 'variantId': variantId,
        if (item.isPackage && includedSelections.isNotEmpty)
          'included': includedSelections.map((k, v) => MapEntry(k.toString(), v)),
      };
}

/// Cross-screen cart state — mirrors the web's `localStorage`-backed
/// cart (booking.js) closely enough that "add here, see it in the cart
/// sheet elsewhere" behaves the same way. Persisted to
/// shared_preferences by (id, variantId) only — included-service
/// customization isn't persisted across restarts, an acceptable v1 gap.
class CartModel extends ChangeNotifier {
  static const _prefsKey = 'cart_lines';

  final List<CartLine> _lines = [];
  List<CartLine> get lines => List.unmodifiable(_lines);

  double get subtotal => _lines.fold(0, (sum, l) => sum + l.lineTotal);
  int get itemCount => _lines.fold(0, (sum, l) => sum + l.qty);
  bool get isEmpty => _lines.isEmpty;

  int _indexOf(String itemId, int? variantId) =>
      _lines.indexWhere((l) => l.item.id == itemId && l.variantId == variantId);

  void add(CatalogItem item, {int? variantId, Map<int, int>? includedSelections, int qty = 1}) {
    final idx = _indexOf(item.id, variantId);
    if (idx >= 0) {
      _lines[idx].qty += qty;
    } else {
      _lines.add(CartLine(item: item, qty: qty, variantId: variantId, includedSelections: includedSelections));
    }
    _persist();
    notifyListeners();
  }

  void updateQty(CartLine line, int qty) {
    if (qty <= 0) {
      _lines.remove(line);
    } else {
      line.qty = qty;
    }
    _persist();
    notifyListeners();
  }

  void remove(CartLine line) {
    _lines.remove(line);
    _persist();
    notifyListeners();
  }

  void clear() {
    _lines.clear();
    _persist();
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = _lines
        .map((l) => {'id': l.item.id, 'variantId': l.variantId, 'qty': l.qty})
        .toList();
    await prefs.setString(_prefsKey, jsonEncode(raw));
  }

  /// Re-adds saved `{id, variantId, qty}` lines once the real catalog
  /// has loaded (see main.dart) — persisted lines only carry an id, not
  /// a full [CatalogItem], so this needs the freshly-fetched catalog to
  /// resolve each id back into one.
  Future<void> restore(List<CatalogItem> catalog) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;
    try {
      final saved = jsonDecode(raw) as List;
      for (final entry in saved) {
        final map = entry as Map<String, dynamic>;
        final item = catalog.where((c) => c.id == map['id']).toList();
        if (item.isEmpty) continue;
        _lines.add(CartLine(item: item.first, qty: map['qty'] as int, variantId: map['variantId'] as int?));
      }
      notifyListeners();
    } catch (_) {
      // Corrupt/stale cache — start with an empty cart rather than crash.
    }
  }
}
