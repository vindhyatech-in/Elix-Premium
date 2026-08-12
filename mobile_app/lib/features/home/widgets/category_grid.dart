import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../catalog/models/catalog_item.dart';

const _icons = [
  Icons.face_retouching_natural_rounded,
  Icons.spa_rounded,
  Icons.content_cut_rounded,
  Icons.self_improvement_rounded,
  Icons.brush_rounded,
  Icons.back_hand_rounded,
];

const _gradients = [
  AppColors.categoryFacial,
  AppColors.categoryWaxing,
  AppColors.categoryThreading,
  AppColors.categoryBodySpa,
];

const _iconColors = [Color(0xFFE53E3E), Color(0xFFD97706), Color(0xFFE11D48), Color(0xFF059669)];

/// 2-column grid of real catalog categories (GET /api/v1/categories/) —
/// tapping one opens the catalog pre-filtered to it. Icon/gradient are
/// cosmetic and cycle through a small fixed palette since the category
/// set itself is admin-editable/dynamic, not a fixed known list.
class CategoryGrid extends StatelessWidget {
  final List<CatalogCategory> categories;
  final ValueChanged<CatalogCategory>? onTap;

  const CategoryGrid({super.key, required this.categories, this.onTap});

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.3,
      ),
      itemCount: categories.length,
      itemBuilder: (context, i) => _CategoryCard(
        category: categories[i],
        icon: _icons[i % _icons.length],
        gradient: _gradients[i % _gradients.length],
        iconColor: _iconColors[i % _iconColors.length],
        onTap: () => onTap?.call(categories[i]),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  final CatalogCategory category;
  final IconData icon;
  final List<Color> gradient;
  final Color iconColor;
  final VoidCallback onTap;

  const _CategoryCard({required this.category, required this.icon, required this.gradient, required this.iconColor, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: gradient, begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: gradient.last.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 4))],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            Text(
              category.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF1E293B), height: 1.2),
            ),
          ],
        ),
      ),
    );
  }
}
