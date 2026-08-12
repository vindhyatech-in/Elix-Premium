import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/cart/cart_model.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../catalog/models/catalog_item.dart';

/// A service or package's detail page — mirrors
/// templates/booking/pages/service_detail.html: hero photo, badges,
/// rating, price/MRP + duration, a variant picker for a `Service` with
/// multiple options, or an included-services breakdown with per-service
/// variant dropdowns for a `Package` (live-recalculated the same way
/// bookings.views._resolve_cart_pricing prices a customized package —
/// see core/cart/cart_model.dart::computePackagePricing), then Add to
/// Cart.
class ServiceDetailScreen extends StatefulWidget {
  final CatalogItem item;
  const ServiceDetailScreen({super.key, required this.item});

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  int? _selectedVariantId;
  final Map<int, int> _includedSelections = {};

  @override
  void initState() {
    super.initState();
    final variants = widget.item.variants;
    if (variants.length > 1) {
      _selectedVariantId = variants.firstWhere((v) => v.isDefault, orElse: () => variants.first).id;
    }
  }

  CatalogVariant? get _activeVariant {
    if (_selectedVariantId == null) return null;
    final matches = widget.item.variants.where((v) => v.id == _selectedVariantId);
    return matches.isEmpty ? null : matches.first;
  }

  void _addToCart() {
    final cart = context.read<CartModel>();
    cart.add(
      widget.item,
      variantId: _selectedVariantId,
      includedSelections: _includedSelections.isEmpty ? null : Map.of(_includedSelections),
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${widget.item.name} added to cart'), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final variant = _activeVariant;
    final price = item.isPackage
        ? computePackagePricing(item, _includedSelections).price
        : (variant?.price ?? item.price);
    final mrp = item.isPackage
        ? computePackagePricing(item, _includedSelections).mrp
        : (variant?.mrp ?? item.mrp);
    final durationLabel = variant?.durationLabel ?? item.durationLabel;
    final discountPct = variant?.discountPct ?? item.discountPct;

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: AppColors.cardLight,
            expandedHeight: 260,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    item.photoUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(color: AppColors.primaryLight),
                  ),
                  Positioned(
                    top: 60,
                    left: 12,
                    child: Row(children: [
                      if (discountPct != null && discountPct > 0)
                        _Pill(text: '$discountPct% OFF', color: AppColors.accentGreen),
                      const SizedBox(width: 6),
                      _Pill(text: item.isPackage ? 'PACKAGE' : 'SERVICE', color: AppColors.primary),
                    ]),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.category.toUpperCase(),
                      style: const TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary, letterSpacing: 0.4)),
                  const SizedBox(height: 4),
                  Text(item.name, style: AppTheme.displayLg.copyWith(fontSize: 24)),
                  const SizedBox(height: 8),
                  if (item.reviewsCount > 0)
                    Row(children: [
                      const Icon(Icons.star_rounded, size: 16, color: AppColors.accentGold),
                      const SizedBox(width: 4),
                      Text('${item.rating.toStringAsFixed(1)} (${item.reviewsCount} reviews)', style: AppTheme.bodySm),
                    ]),
                  const SizedBox(height: 12),
                  Text(item.description, style: AppTheme.bodyMd),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: const BoxDecoration(
                        border: Border(top: BorderSide(color: AppColors.borderLight), bottom: BorderSide(color: AppColors.borderLight))),
                    child: Row(
                      children: [
                        Text('₹${price.toStringAsFixed(0)}',
                            style: const TextStyle(fontFamily: 'Inter', fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                        if (mrp != null && mrp > price) ...[
                          const SizedBox(width: 8),
                          Text('₹${mrp.toStringAsFixed(0)}',
                              style: const TextStyle(fontFamily: 'Inter', fontSize: 15, color: AppColors.textMuted, decoration: TextDecoration.lineThrough)),
                        ],
                        const Spacer(),
                        Text('⏱ $durationLabel', style: AppTheme.bodySm.copyWith(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  if (!item.isPackage && item.variants.length > 1) ...[
                    const SizedBox(height: 16),
                    const Text('Choose an option', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: item.variants.map((v) {
                        final selected = v.id == _selectedVariantId;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedVariantId = v.id),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                            decoration: BoxDecoration(
                              color: selected ? AppColors.primary : AppColors.bgLight,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight),
                            ),
                            child: Text('${v.label.isNotEmpty ? v.label : v.durationLabel} — ₹${v.price.toStringAsFixed(0)}',
                                style: TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: selected ? Colors.white : AppColors.textPrimary)),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                  if (item.isPackage && item.includedServices.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text('Included Services', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                    const SizedBox(height: 8),
                    ...item.includedServices.map((inc) => _IncludedServiceRow(
                          inc: inc,
                          selectedVariantId: _includedSelections[inc.id] ?? inc.selectedVariantId,
                          onChanged: (variantId) => setState(() {
                            if (variantId == inc.selectedVariantId) {
                              _includedSelections.remove(inc.id);
                            } else {
                              _includedSelections[inc.id] = variantId;
                            }
                          }),
                        )),
                  ],
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: item.availableToday ? _addToCart : null,
                      child: Text(item.availableToday ? 'Add to Cart' : 'Not available today'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String text;
  final Color color;
  const _Pill({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
      child: Text(text, style: const TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
    );
  }
}

class _IncludedServiceRow extends StatelessWidget {
  final IncludedService inc;
  final int selectedVariantId;
  final ValueChanged<int> onChanged;
  const _IncludedServiceRow({required this.inc, required this.selectedVariantId, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.cardLight,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Image.network(inc.photoUrl, width: 36, height: 36, fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(width: 36, height: 36, color: AppColors.primaryLight)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(inc.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
          ),
          if (inc.variants.length > 1)
            DropdownButton<int>(
              value: selectedVariantId,
              underline: const SizedBox.shrink(),
              items: inc.variants
                  .map((v) => DropdownMenuItem(value: v.id, child: Text('${v.label} (₹${v.price.toStringAsFixed(0)})', style: const TextStyle(fontFamily: 'Inter', fontSize: 12))))
                  .toList(),
              onChanged: (v) {
                if (v != null) onChanged(v);
              },
            )
          else
            Text('₹${inc.price.toStringAsFixed(0)}', style: const TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}
