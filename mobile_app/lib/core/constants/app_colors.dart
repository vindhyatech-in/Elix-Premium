import 'package:flutter/material.dart';

class AppColors {
  // ── Primary Brand ──────────────────────────────────────────────────────────
  static const Color primary = Color(0xFF4F46E5);      // Royal Indigo
  static const Color primaryLight = Color(0xFFEEF2FF); // Indigo tint (bg chips)
  static const Color primaryDark = Color(0xFF3730A3);  // Pressed state

  // ── Accent Colors ──────────────────────────────────────────────────────────
  static const Color accentGreen = Color(0xFF059669);       // Emerald: offers, badges
  static const Color accentGreenLight = Color(0xFFECFDF5);  // Emerald surface
  static const Color accentGold = Color(0xFFC9A15A);        // Champagne gold: stars, luxury
  static const Color accentGoldLight = Color(0xFFFEF9EC);   // Gold surface

  // ── Light Mode Surfaces ────────────────────────────────────────────────────
  static const Color bgLight = Color(0xFFF8FAFC);      // Page background
  static const Color cardLight = Color(0xFFFFFFFF);    // Card surface
  static const Color borderLight = Color(0xFFE2E8F0);  // Subtle border

  // ── Dark Mode Surfaces ─────────────────────────────────────────────────────
  static const Color bgDark = Color(0xFF0F172A);       // Navy page background
  static const Color cardDark = Color(0xFF1E293B);     // Dark card surface
  static const Color borderDark = Color(0xFF334155);   // Dark border

  // ── Text ───────────────────────────────────────────────────────────────────
  static const Color textPrimary = Color(0xFF0F172A);    // Headings
  static const Color textSecondary = Color(0xFF64748B);  // Subtitles
  static const Color textMuted = Color(0xFF94A3B8);      // Placeholder / hint
  static const Color textLight = Color(0xFFF8FAFC);      // On dark background
  static const Color textOnPrimary = Color(0xFFFFFFFF);  // On primary button

  // ── Status ─────────────────────────────────────────────────────────────────
  static const Color statusUpcoming = Color(0xFF059669);   // Emerald green
  static const Color statusOnWay = Color(0xFF4F46E5);      // Indigo
  static const Color statusInProgress = Color(0xFFD97706); // Amber
  static const Color statusCompleted = Color(0xFF64748B);  // Slate gray
  static const Color statusCancelled = Color(0xFFDC2626);  // Red

  // ── Gradients (as list pairs for LinearGradient) ──────────────────────────
  static const List<Color> heroBannerGradient = [
    Color(0xFF3730A3), // Indigo 700
    Color(0xFF4F46E5), // Indigo 600
    Color(0xFF6366F1), // Indigo 500
  ];

  static const List<Color> categoryFacial = [
    Color(0xFFFDE2DC), Color(0xFFF9C0B5)
  ];
  static const List<Color> categoryWaxing = [
    Color(0xFFFEF3C7), Color(0xFFFDE68A)
  ];
  static const List<Color> categoryThreading = [
    Color(0xFFFFE4E6), Color(0xFFFECDD3)
  ];
  static const List<Color> categoryBodySpa = [
    Color(0xFFCCFBF1), Color(0xFF99F6E4)
  ];

  // ── Misc ───────────────────────────────────────────────────────────────────
  static const Color borderHairline = Color(0x140F172A); // rgba(15, 23, 42, 0.08)
  static const Color scrim = Color(0x800F172A);           // Modal backdrop
}
