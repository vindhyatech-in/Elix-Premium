import 'package:flutter/material.dart';
import '../../../core/constants/app_strings.dart';

/// Three horizontal trust pills: Sealed Kits, 50-Min Express, Verified Experts.
class TrustStrip extends StatelessWidget {
  const TrustStrip({super.key});

  static const _pills = [
    AppStrings.trust1,
    AppStrings.trust2,
    AppStrings.trust3,
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _pills.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF334155), width: 1),
          ),
          child: Text(
            _pills[i],
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFFCBD5E1),
            ),
          ),
        ),
      ),
    );
  }
}
