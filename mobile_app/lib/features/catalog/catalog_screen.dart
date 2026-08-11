import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/status_badge.dart';

// ── Mock data (replace with API call to /api/v1/services/) ───────────────────

class ServiceModel {
  final String id;
  final String name;
  final String category;
  final int durationMins;
  final double price;
  final double mrp;
  final double? rating;
  final int? reviewsCount;
  final bool isBestseller;
  final List<Color> gradient;
  final IconData icon;
  final Color iconColor;

  const ServiceModel({
    required this.id,
    required this.name,
    required this.category,
    required this.durationMins,
    required this.price,
    required this.mrp,
    this.rating,
    this.reviewsCount,
    this.isBestseller = false,
    required this.gradient,
    required this.icon,
    required this.iconColor,
  });

  int get discountPct => mrp > price ? ((mrp - price) / mrp * 100).round() : 0;
  String get durationLabel =>
      durationMins < 60 ? '$durationMins min' : '${durationMins ~/ 60}h ${durationMins % 60}min'.replaceAll(' 0min', '');
}

const _mockServices = [
  ServiceModel(
    id: 'eyebrow-threading',
    name: 'Eyebrow Threading',
    category: 'Threading',
    durationMins: 15,
    price: 79,
    mrp: 120,
    rating: 4.8,
    reviewsCount: 142,
    gradient: [Color(0xFFFFE4E6), Color(0xFFFECDD3)],
    icon: Icons.content_cut_rounded,
    iconColor: Color(0xFFE11D48),
  ),
  ServiceModel(
    id: 'full-face-threading',
    name: 'Full Face Threading',
    category: 'Threading',
    durationMins: 30,
    price: 149,
    mrp: 250,
    rating: 4.9,
    reviewsCount: 89,
    gradient: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
    icon: Icons.face_retouching_natural_rounded,
    iconColor: Color(0xFFD97706),
  ),
  ServiceModel(
    id: 'basic-facial',
    name: 'Basic Facial',
    category: 'Facial',
    durationMins: 60,
    price: 599,
    mrp: 899,
    rating: 4.7,
    reviewsCount: 203,
    isBestseller: true,
    gradient: [Color(0xFFEDE9FE), Color(0xFFDDD6FE)],
    icon: Icons.spa_rounded,
    iconColor: Color(0xFF7C3AED),
  ),
  ServiceModel(
    id: 'upper-lip-threading',
    name: 'Upper Lip Threading',
    category: 'Threading',
    durationMins: 10,
    price: 49,
    mrp: 80,
    rating: 4.6,
    reviewsCount: 315,
    gradient: [Color(0xFFCCFBF1), Color(0xFF99F6E4)],
    icon: Icons.brush_rounded,
    iconColor: Color(0xFF059669),
  ),
  ServiceModel(
    id: 'full-arms-wax',
    name: 'Full Arms Wax (Honey)',
    category: 'Waxing',
    durationMins: 30,
    price: 199,
    mrp: 280,
    gradient: [Color(0xFFFDE2DC), Color(0xFFF9C0B5)],
    icon: Icons.back_hand_rounded,
    iconColor: Color(0xFFE53E3E),
  ),
];

// ── Catalog Screen ────────────────────────────────────────────────────────────

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _selectedCategory = 'all';
  String _searchQuery = '';

  final _filterCategories = ['all', 'threading', 'facial', 'waxing', 'body_spa'];
  final _filterLabels = ['All', 'Threading', 'Facials', 'Waxing', 'Body Spa'];

  List<ServiceModel> get _filtered {
    return _mockServices.where((s) {
      final matchCat = _selectedCategory == 'all' ||
          s.category.toLowerCase() == _filterLabels[
              _filterCategories.indexOf(_selectedCategory)].toLowerCase();
      final matchSearch = _searchQuery.isEmpty ||
          s.name.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchCat && matchSearch;
    }).toList();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.cardLight,
        elevation: 0,
        title: const Text(
          'Services',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w800,
            fontSize: 20,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: false,
      ),
      body: Column(
        children: [
          // ── Search Bar ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _searchQuery = v),
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
              decoration: InputDecoration(
                hintText: 'Search services...',
                prefixIcon: const Icon(Icons.search_rounded,
                    color: AppColors.textMuted, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? GestureDetector(
                        onTap: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                        child: const Icon(Icons.close_rounded,
                            color: AppColors.textMuted, size: 18),
                      )
                    : const Icon(Icons.tune_rounded,
                        color: AppColors.textMuted, size: 20),
                filled: true,
                fillColor: AppColors.bgLight,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.borderLight),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppColors.borderLight),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide:
                      const BorderSide(color: AppColors.primary, width: 2),
                ),
              ),
            ),
          ),

          // ── Filter Chips ─────────────────────────────────────────────
          const SizedBox(height: 12),
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _filterCategories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final selected = _selectedCategory == _filterCategories[i];
                return GestureDetector(
                  onTap: () => setState(
                      () => _selectedCategory = _filterCategories[i]),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.primary
                          : AppColors.bgLight,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: selected
                            ? AppColors.primary
                            : AppColors.borderLight,
                        width: 1.5,
                      ),
                    ),
                    child: Text(
                      _filterLabels[i],
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: selected
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: selected
                            ? Colors.white
                            : AppColors.textSecondary,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 12),

          // ── Section Header ───────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  AppStrings.popularSectionTitle,
                  style: AppTheme.headingMd,
                ),
                Text(
                  '${_filtered.length} services',
                  style: AppTheme.bodySm.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          // ── Service List ─────────────────────────────────────────────
          Expanded(
            child: _filtered.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.search_off_rounded,
                            size: 48, color: AppColors.textMuted),
                        SizedBox(height: 8),
                        Text(
                          'No services found',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            color: AppColors.textSecondary,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                    itemCount: _filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) =>
                        ServiceCard(service: _filtered[i]),
                  ),
          ),
        ],
      ),
    );
  }
}

// ── Service Card ─────────────────────────────────────────────────────────────

class ServiceCard extends StatefulWidget {
  final ServiceModel service;
  const ServiceCard({super.key, required this.service});

  @override
  State<ServiceCard> createState() => _ServiceCardState();
}

class _ServiceCardState extends State<ServiceCard> {
  int _qty = 0;

  @override
  Widget build(BuildContext context) {
    final s = widget.service;
    return Container(
      decoration: AppTheme.cardDecoration(),
      padding: const EdgeInsets.all(12),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Thumbnail ────────────────────────────────────────────
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: s.gradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Icon(s.icon, color: s.iconColor, size: 30),
                ),
              ),

              const SizedBox(width: 12),

              // ── Details ───────────────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + discount badge
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            s.name,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        if (s.discountPct > 0)
                          LabelBadge(text: '${s.discountPct}% OFF'),
                      ],
                    ),

                    const SizedBox(height: 3),

                    // Category · Duration
                    Text(
                      '${s.category} · ${s.durationLabel}',
                      style: AppTheme.bodySm,
                    ),

                    const SizedBox(height: 6),

                    // Price row
                    Row(
                      children: [
                        Text(
                          '₹${s.price.toInt()}',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        if (s.mrp > s.price)
                          Text(
                            '₹${s.mrp.toInt()} MRP',
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: AppColors.textMuted,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                      ],
                    ),

                    const SizedBox(height: 8),

                    // Rating + Add button
                    Row(
                      children: [
                        if (s.rating != null && s.reviewsCount != null) ...[
                          const Icon(Icons.star_rounded,
                              size: 14, color: AppColors.accentGold),
                          const SizedBox(width: 2),
                          Text(
                            '${s.rating!.toStringAsFixed(1)} (${s.reviewsCount})',
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                        const Spacer(),
                        // Add / qty control
                        _qty == 0
                            ? _AddButton(
                                onTap: () => setState(() => _qty = 1))
                            : _QtyControl(
                                qty: _qty,
                                onDecrement: () =>
                                    setState(() => _qty = _qty - 1),
                                onIncrement: () =>
                                    setState(() => _qty = _qty + 1),
                              ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // ── BESTSELLER badge (top-right corner) ──────────────────────
          if (s.isBestseller)
            Positioned(
              top: -6,
              right: -6,
              child: LabelBadge(
                text: AppStrings.bestseller,
                bgColor: AppColors.accentGold,
                color: Colors.white,
              ),
            ),
        ],
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  final VoidCallback onTap;
  const _AddButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Text(
          'Add',
          style: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
            fontSize: 13,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _QtyControl extends StatelessWidget {
  final int qty;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  const _QtyControl({
    required this.qty,
    required this.onDecrement,
    required this.onIncrement,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: onDecrement,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              child: Icon(Icons.remove_rounded,
                  color: Colors.white, size: 16),
            ),
          ),
          Text(
            '$qty',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: Colors.white,
            ),
          ),
          GestureDetector(
            onTap: onIncrement,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              child: Icon(Icons.add_rounded, color: Colors.white, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}
