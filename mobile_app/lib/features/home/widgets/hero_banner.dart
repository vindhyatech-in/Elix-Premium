import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';

/// Full-width hero banner card with indigo gradient, express badge, headline,
/// subtitle, and two CTA buttons.
class HeroBanner extends StatelessWidget {
  final VoidCallback onBookExpress;
  final VoidCallback onBrowseServices;

  const HeroBanner({
    super.key,
    required this.onBookExpress,
    required this.onBrowseServices,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: AppColors.heroBannerGradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.35),
            blurRadius: 20,
            spreadRadius: 0,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Express badge ──────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.accentGreen,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              AppStrings.urgentBadge,
              style: const TextStyle(
                fontFamily: 'Inter',
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.2,
              ),
            ),
          ),

          const SizedBox(height: 14),

          // ── Headline ───────────────────────────────────────────────────
          const Text(
            AppStrings.heroHeadline,
            style: TextStyle(
              fontFamily: 'Inter',
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w900,
              height: 1.15,
              letterSpacing: -0.5,
            ),
          ),

          const SizedBox(height: 8),

          // ── Subtitle ───────────────────────────────────────────────────
          const Text(
            AppStrings.heroSubtitle,
            style: TextStyle(
              fontFamily: 'Inter',
              color: Color(0xCCFFFFFF), // white 80%
              fontSize: 13,
              fontWeight: FontWeight.w400,
              height: 1.4,
            ),
          ),

          const SizedBox(height: 20),

          // ── CTA Buttons ────────────────────────────────────────────────
          Row(
            children: [
              // Primary: Book Express
              Expanded(
                child: ElevatedButton(
                  onPressed: onBookExpress,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primary,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    AppStrings.bookExpressBtn,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 10),

              // Secondary: Browse Services
              Expanded(
                child: OutlinedButton(
                  onPressed: onBrowseServices,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(
                        color: Color(0x80FFFFFF), width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    AppStrings.browseServicesBtn,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
