import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';

/// Data model for a single category tile in the grid.
class CategoryItem {
  final String title;
  final String subtitle;
  final String fromPrice;
  final IconData icon;
  final List<Color> gradient;
  final Color iconColor;

  const CategoryItem({
    required this.title,
    required this.subtitle,
    required this.fromPrice,
    required this.icon,
    required this.gradient,
    required this.iconColor,
  });
}

const _categories = [
  CategoryItem(
    title: AppStrings.catFacialLabel,
    subtitle: AppStrings.catFacialSub,
    fromPrice: '₹499',
    icon: Icons.face_retouching_natural_rounded,
    gradient: AppColors.categoryFacial,
    iconColor: Color(0xFFE53E3E),
  ),
  CategoryItem(
    title: AppStrings.catWaxingLabel,
    subtitle: AppStrings.catWaxingSub,
    fromPrice: '₹199',
    icon: Icons.spa_rounded,
    gradient: AppColors.categoryWaxing,
    iconColor: Color(0xFFD97706),
  ),
  CategoryItem(
    title: AppStrings.catThreadingLabel,
    subtitle: AppStrings.catThreadingSub,
    fromPrice: '₹79',
    icon: Icons.content_cut_rounded,
    gradient: AppColors.categoryThreading,
    iconColor: Color(0xFFE11D48),
  ),
  CategoryItem(
    title: AppStrings.catBodySpaLabel,
    subtitle: AppStrings.catBodySpaSub,
    fromPrice: '₹899',
    icon: Icons.self_improvement_rounded,
    gradient: AppColors.categoryBodySpa,
    iconColor: Color(0xFF059669),
  ),
];

/// 2-column grid of category cards with gradient backgrounds.
class CategoryGrid extends StatelessWidget {
  final ValueChanged<CategoryItem>? onTap;

  const CategoryGrid({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.05,
      ),
      itemCount: _categories.length,
      itemBuilder: (context, i) => _CategoryCard(
        item: _categories[i],
        onTap: () => onTap?.call(_categories[i]),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  final CategoryItem item;
  final VoidCallback onTap;

  const _CategoryCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: item.gradient,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: item.gradient.last.withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // ── Icon ───────────────────────────────────────────────────
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(item.icon, color: item.iconColor, size: 24),
            ),

            // ── Text ────────────────────────────────────────────────────
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: Color(0xFF1E293B),
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: Color(0xFF475569),
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${AppStrings.fromPrefix}${item.fromPrice.replaceAll("₹", "")}',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: Color(0xFF1E293B),
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
