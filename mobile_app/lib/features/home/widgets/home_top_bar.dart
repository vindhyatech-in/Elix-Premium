import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';

/// Top bar for the home screen — light theme, matching the marketing
/// page's own white/cream look (this screen used to be a dark
/// dashboard; now it mirrors the real landing page's sections, see
/// home_screen.dart, so it needed to match).
class HomeTopBar extends StatelessWidget implements PreferredSizeWidget {
  const HomeTopBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: preferredSize.height + MediaQuery.of(context).padding.top,
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top,
        left: 16,
        right: 16,
      ),
      decoration: const BoxDecoration(
        color: AppColors.cardLight,
        border: Border(bottom: BorderSide(color: AppColors.borderLight, width: 1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: const TextSpan(
                    children: [
                      TextSpan(
                        text: 'E',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.primary, letterSpacing: -0.5),
                      ),
                      TextSpan(
                        text: 'lix',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.textPrimary, letterSpacing: -0.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 1),
                Row(
                  children: const [
                    Icon(Icons.location_on_rounded, size: 12, color: AppColors.textMuted),
                    SizedBox(width: 2),
                    Text(
                      AppStrings.serviceCity,
                      style: TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Stack(
            children: [
              _IconBtn(icon: Icons.notifications_rounded, onTap: () {}),
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: AppColors.accentGreen, shape: BoxShape.circle, border: Border.all(color: AppColors.cardLight, width: 1.5)),
                ),
              ),
            ],
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: () {},
            child: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [AppColors.primary, Color(0xFF818CF8)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              ),
              child: const Center(
                child: Text('G', style: TextStyle(fontFamily: 'Inter', color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _IconBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: AppColors.bgLight, borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: AppColors.textSecondary, size: 20),
      ),
    );
  }
}
