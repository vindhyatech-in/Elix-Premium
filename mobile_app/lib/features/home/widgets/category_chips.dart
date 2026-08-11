import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';

/// Data class for a single category filter chip.
class CategoryChipData {
  final String label;
  final String key;
  const CategoryChipData({required this.label, required this.key});
}

const _chips = [
  CategoryChipData(label: AppStrings.catAll, key: 'all'),
  CategoryChipData(label: AppStrings.catFacial, key: 'facial'),
  CategoryChipData(label: AppStrings.catWaxing, key: 'waxing'),
  CategoryChipData(label: AppStrings.catThreading, key: 'threading'),
  CategoryChipData(label: AppStrings.catBodySpa, key: 'body_spa'),
];

/// Horizontal scrollable row of filter chips.
/// [selectedKey] is the currently active category key.
/// [onSelected] fires when a chip is tapped.
class CategoryChipsBar extends StatelessWidget {
  final String selectedKey;
  final ValueChanged<String> onSelected;

  const CategoryChipsBar({
    super.key,
    required this.selectedKey,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final chip = _chips[i];
          final selected = chip.key == selectedKey;
          return GestureDetector(
            onTap: () => onSelected(chip.key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(
                color: selected ? AppColors.primary : const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: selected
                      ? AppColors.primary
                      : const Color(0xFF334155),
                  width: 1.5,
                ),
              ),
              child: Text(
                chip.label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight:
                      selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? Colors.white : const Color(0xFF94A3B8),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
