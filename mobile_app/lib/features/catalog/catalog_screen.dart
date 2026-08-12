import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/catalog_repository.dart';
import '../../core/cart/cart_model.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/status_badge.dart';
import '../service_detail/service_detail_screen.dart';
import 'models/catalog_item.dart';

const _sortOptions = [
  {'key': 'popularity', 'label': 'Most Popular'},
  {'key': 'newest', 'label': 'Newest'},
  {'key': 'price-asc', 'label': 'Price ↑'},
  {'key': 'price-desc', 'label': 'Price ↓'},
  {'key': 'rating', 'label': 'Top Rated'},
  {'key': 'duration', 'label': 'Duration'},
];

/// The full catalog browsing experience — mirrors
/// templates/booking/pages/service_booking.html's search bar + sort bar
/// + filter sidebar (collapsed to a bottom sheet on mobile, same as
/// booking.css's max-width:1023px rules) + catalog grid. Reached by
/// pushing from Home (category tap / "Browse Services"), not a bottom
/// nav tab itself — see main.dart.
class CatalogScreen extends StatefulWidget {
  final String? initialCategory;
  const CatalogScreen({super.key, this.initialCategory});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _searchCtrl = TextEditingController();
  final _repo = CatalogRepository();

  bool _loading = true;
  String? _error;
  List<CatalogItem> _all = [];
  List<CatalogCategory> _categories = [];

  String _searchQuery = '';
  String _sort = 'popularity';
  String _typeFilter = 'all';
  Set<String> _categoryFilter = {};
  double _minRating = 0;
  bool _onOfferOnly = false;
  bool _availableTodayOnly = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialCategory != null) _categoryFilter = {widget.initialCategory!};
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([_repo.fetchCatalog(), _repo.fetchCategories()]);
      setState(() {
        _all = results[0] as List<CatalogItem>;
        _categories = results[1] as List<CatalogCategory>;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  int get _activeFilterCount =>
      (_typeFilter != 'all' ? 1 : 0) +
      _categoryFilter.length +
      (_minRating > 0 ? 1 : 0) +
      (_onOfferOnly ? 1 : 0) +
      (_availableTodayOnly ? 1 : 0);

  List<CatalogItem> get _filteredSorted {
    var items = _all.where((item) {
      if (_typeFilter != 'all' && item.kind != _typeFilter) return false;
      if (_categoryFilter.isNotEmpty && !_categoryFilter.contains(item.category)) return false;
      if (_minRating > 0 && item.rating < _minRating) return false;
      if (_onOfferOnly && (item.discountPct == null || item.discountPct == 0)) return false;
      if (_availableTodayOnly && !item.availableToday) return false;
      if (_searchQuery.isNotEmpty && !item.name.toLowerCase().contains(_searchQuery.toLowerCase())) return false;
      return true;
    }).toList();

    switch (_sort) {
      case 'newest':
        items = items.reversed.toList();
        break;
      case 'price-asc':
        items.sort((a, b) => a.price.compareTo(b.price));
        break;
      case 'price-desc':
        items.sort((a, b) => b.price.compareTo(a.price));
        break;
      case 'rating':
        items.sort((a, b) => b.rating.compareTo(a.rating));
        break;
      case 'duration':
        items.sort((a, b) => a.durationMins.compareTo(b.durationMins));
        break;
      default: // popularity
        items.sort((a, b) => b.popularityScore.compareTo(a.popularityScore));
    }
    return items;
  }

  void _openFilters() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FilterSheet(
        categories: _categories,
        typeFilter: _typeFilter,
        categoryFilter: _categoryFilter,
        minRating: _minRating,
        onOfferOnly: _onOfferOnly,
        availableTodayOnly: _availableTodayOnly,
        onApply: (type, cats, rating, offer, availableToday) {
          setState(() {
            _typeFilter = type;
            _categoryFilter = cats;
            _minRating = rating;
            _onOfferOnly = offer;
            _availableTodayOnly = availableToday;
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSorted;
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.cardLight,
        elevation: 0,
        title: const Text('Services', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary)),
        centerTitle: false,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (v) => setState(() => _searchQuery = v),
                        decoration: InputDecoration(
                          hintText: 'Search services, packages…',
                          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? GestureDetector(
                                  onTap: () {
                                    _searchCtrl.clear();
                                    setState(() => _searchQuery = '');
                                  },
                                  child: const Icon(Icons.close_rounded, color: AppColors.textMuted, size: 18),
                                )
                              : null,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Text('${filtered.length} services & packages',
                              style: AppTheme.bodySm.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
                          const Spacer(),
                          _FilterButton(count: _activeFilterCount, onTap: _openFilters),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 36,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _sortOptions.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (context, i) {
                          final opt = _sortOptions[i];
                          final selected = _sort == opt['key'];
                          return GestureDetector(
                            onTap: () => setState(() => _sort = opt['key']!),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                              decoration: BoxDecoration(
                                color: selected ? AppColors.primary : AppColors.bgLight,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight),
                              ),
                              child: Text(opt['label']!,
                                  style: TextStyle(
                                      fontFamily: 'Inter',
                                      fontSize: 12,
                                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                                      color: selected ? Colors.white : AppColors.textSecondary)),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: filtered.isEmpty
                          ? const Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.search_off_rounded, size: 48, color: AppColors.textMuted),
                                  SizedBox(height: 8),
                                  Text('No services found', style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary, fontSize: 15)),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              child: ListView.separated(
                                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                                itemCount: filtered.length,
                                separatorBuilder: (_, _) => const SizedBox(height: 10),
                                itemBuilder: (context, i) => _CatalogCardTile(item: filtered[i]),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  final int count;
  final VoidCallback onTap;
  const _FilterButton({required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.bgLight,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.tune_rounded, size: 15, color: AppColors.textPrimary),
            const SizedBox(width: 4),
            const Text('Filters', style: TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            if (count > 0) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                child: Text('$count', style: const TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 44, color: AppColors.textMuted),
            const SizedBox(height: 10),
            Text(message, textAlign: TextAlign.center, style: AppTheme.bodyMd),
            const SizedBox(height: 14),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

/// A filter bottom sheet — mirrors filter_sidebar.html's Type/Category/
/// Minimum Rating/Extras groups. Keeps its own draft state so "Clear
/// Filters" and dismissing without applying don't mutate the parent's
/// filters until "Apply" is tapped.
class _FilterSheet extends StatefulWidget {
  final List<CatalogCategory> categories;
  final String typeFilter;
  final Set<String> categoryFilter;
  final double minRating;
  final bool onOfferOnly;
  final bool availableTodayOnly;
  final void Function(String type, Set<String> categories, double minRating, bool onOfferOnly, bool availableTodayOnly) onApply;

  const _FilterSheet({
    required this.categories,
    required this.typeFilter,
    required this.categoryFilter,
    required this.minRating,
    required this.onOfferOnly,
    required this.availableTodayOnly,
    required this.onApply,
  });

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String _type = widget.typeFilter;
  late Set<String> _cats = {...widget.categoryFilter};
  late double _rating = widget.minRating;
  late bool _offer = widget.onOfferOnly;
  late bool _availableToday = widget.availableTodayOnly;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      decoration: const BoxDecoration(color: AppColors.cardLight, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Filters', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.textPrimary)),
                IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close_rounded)),
              ],
            ),
            _FilterLabel('Type'),
            Wrap(spacing: 8, children: [
              _SegChip(label: 'All', selected: _type == 'all', onTap: () => setState(() => _type = 'all')),
              _SegChip(label: 'Single Services', selected: _type == 'service', onTap: () => setState(() => _type = 'service')),
              _SegChip(label: 'Packages', selected: _type == 'package', onTap: () => setState(() => _type = 'package')),
            ]),
            _FilterLabel('Category'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: widget.categories
                  .map((c) => _SegChip(
                        label: c.name,
                        selected: _cats.contains(c.slug),
                        onTap: () => setState(() {
                          if (_cats.contains(c.slug)) {
                            _cats.remove(c.slug);
                          } else {
                            _cats.add(c.slug);
                          }
                        }),
                      ))
                  .toList(),
            ),
            _FilterLabel('Minimum Rating'),
            Wrap(spacing: 8, children: [
              _SegChip(label: 'Any', selected: _rating == 0, onTap: () => setState(() => _rating = 0)),
              _SegChip(label: '4.0+', selected: _rating == 4.0, onTap: () => setState(() => _rating = 4.0)),
              _SegChip(label: '4.5+', selected: _rating == 4.5, onTap: () => setState(() => _rating = 4.5)),
            ]),
            _FilterLabel('Extras'),
            CheckboxListTile(
              value: _offer,
              onChanged: (v) => setState(() => _offer = v ?? false),
              title: const Text('On offer only', style: TextStyle(fontFamily: 'Inter', fontSize: 14)),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              activeColor: AppColors.primary,
            ),
            CheckboxListTile(
              value: _availableToday,
              onChanged: (v) => setState(() => _availableToday = v ?? false),
              title: const Text('Available today', style: TextStyle(fontFamily: 'Inter', fontSize: 14)),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              activeColor: AppColors.primary,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() {
                      _type = 'all';
                      _cats = {};
                      _rating = 0;
                      _offer = false;
                      _availableToday = false;
                    }),
                    child: const Text('Clear Filters'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      widget.onApply(_type, _cats, _rating, _offer, _availableToday);
                      Navigator.of(context).pop();
                    },
                    child: const Text('Apply'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterLabel extends StatelessWidget {
  final String text;
  const _FilterLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 10),
      child: Text(text.toUpperCase(),
          style: const TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.4)),
    );
  }
}

class _SegChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _SegChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.bgLight,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight),
        ),
        child: Text(label,
            style: TextStyle(
                fontFamily: 'Inter', fontSize: 12, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? Colors.white : AppColors.textSecondary)),
      ),
    );
  }
}

/// One catalog card — mirrors catalog_card.html's layout (thumbnail,
/// badges, name, category/duration, rating, price/MRP, Add button).
class _CatalogCardTile extends StatelessWidget {
  final CatalogItem item;
  const _CatalogCardTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();
    final line = cart.lines.where((l) => l.item.id == item.id && l.variantId == null).toList();
    final qty = line.isEmpty ? 0 : line.first.qty;

    return GestureDetector(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ServiceDetailScreen(item: item))),
      child: Container(
        decoration: AppTheme.cardDecoration(),
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Image.network(
                item.photoUrl,
                width: 76,
                height: 76,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  width: 76,
                  height: 76,
                  color: AppColors.primaryLight,
                  child: const Icon(Icons.spa_rounded, color: AppColors.primary, size: 30),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(item.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
                      ),
                      if (item.isPackage) const LabelBadge(text: 'PACKAGE', bgColor: AppColors.accentGreen),
                      if (item.discountPct != null && item.discountPct! > 0) LabelBadge(text: '${item.discountPct}% OFF'),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text('${item.category} · ${item.durationLabel}', style: AppTheme.bodySm),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text('₹${item.price.toStringAsFixed(0)}',
                          style: const TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                      const SizedBox(width: 6),
                      if (item.mrp != null && item.mrp! > item.price)
                        Text('₹${item.mrp!.toStringAsFixed(0)}',
                            style: const TextStyle(
                                fontFamily: 'Inter', fontSize: 12, color: AppColors.textMuted, decoration: TextDecoration.lineThrough)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (item.reviewsCount > 0) ...[
                        const Icon(Icons.star_rounded, size: 14, color: AppColors.accentGold),
                        const SizedBox(width: 2),
                        Text('${item.rating.toStringAsFixed(1)} (${item.reviewsCount})',
                            style: const TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                      ],
                      const Spacer(),
                      qty == 0
                          ? GestureDetector(
                              onTap: () => cart.add(item),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
                                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
                                child: const Text('Add', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white)),
                              ),
                            )
                          : Container(
                              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                IconButton(
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                                    icon: const Icon(Icons.remove_rounded, color: Colors.white, size: 15),
                                    onPressed: () => cart.updateQty(line.first, qty - 1)),
                                Text('$qty', style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white)),
                                IconButton(
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                                    icon: const Icon(Icons.add_rounded, color: Colors.white, size: 15),
                                    onPressed: () => cart.updateQty(line.first, qty + 1)),
                              ]),
                            ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
