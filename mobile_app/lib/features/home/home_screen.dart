import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/theme/app_theme.dart';
import 'widgets/home_top_bar.dart';
import 'widgets/hero_banner.dart';
import 'widgets/category_chips.dart';
import 'widgets/category_grid.dart';
import 'widgets/trust_strip.dart';
import '../../widgets/serviceability_widget.dart';

/// Main home screen — dark background, scrollable column of sections.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedCategory = 'all';

  void _onBookExpress() {
    // TODO: navigate to urgent booking flow
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🚀 Express booking coming soon!'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _onBrowseServices() {
    // Trigger parent to switch to Catalog tab
    // Uses a callback via context — simplified here
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Browsing services...'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      // Custom top bar replaces AppBar so we control its exact appearance
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: const HomeTopBar(),
      ),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 16),

                // ── Hero Banner ────────────────────────────────────────
                Padding(
                  padding: AppTheme.pagePadding,
                  child: HeroBanner(
                    onBookExpress: _onBookExpress,
                    onBrowseServices: _onBrowseServices,
                  ),
                ),

                const SizedBox(height: 20),

                // ── Trust Strip ────────────────────────────────────────
                const TrustStrip(),

                const SizedBox(height: 20),

                // ── Category Chips ─────────────────────────────────────
                CategoryChipsBar(
                  selectedKey: _selectedCategory,
                  onSelected: (key) =>
                      setState(() => _selectedCategory = key),
                ),

                const SizedBox(height: 20),

                // ── Section Header: Explore ────────────────────────────
                Padding(
                  padding: AppTheme.pagePadding,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        AppStrings.exploreSectionTitle,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: -0.3,
                        ),
                      ),
                      GestureDetector(
                        onTap: _onBrowseServices,
                        child: Row(
                          children: const [
                            Text(
                              AppStrings.seeAll,
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF818CF8),
                              ),
                            ),
                            SizedBox(width: 2),
                            Icon(
                              Icons.arrow_forward_ios_rounded,
                              size: 12,
                              color: Color(0xFF818CF8),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // ── Category Grid ──────────────────────────────────────
                CategoryGrid(
                  onTap: (item) {
                    // TODO: navigate to filtered catalog
                  },
                ),

                const SizedBox(height: 24),

                // ── Section Header: How It Works ───────────────────────
                Padding(
                  padding: AppTheme.pagePadding,
                  child: const Text(
                    AppStrings.howItWorksTitle,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.3,
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // ── How It Works Steps ─────────────────────────────────
                Padding(
                  padding: AppTheme.pagePadding,
                  child: _HowItWorksSection(),
                ),

                const SizedBox(height: 24),

                // ── Serviceability Check ───────────────────────────────
                Padding(
                  padding: AppTheme.pagePadding,
                  child: _DarkServiceabilityWrapper(),
                ),

                // Bottom padding for nav bar clearance
                const SizedBox(height: 100),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── How It Works Section ─────────────────────────────────────────────────────

class _HowItWorksSection extends StatelessWidget {
  static const _steps = [
    _StepData('1', 'Choose Your Ritual',
        'Browse single services or curated packages.', Color(0xFF4F46E5)),
    _StepData('2', 'Select Time & Address',
        'Pick a scheduled slot or 50-Min urgent delivery.', Color(0xFF059669)),
    _StepData('3', 'Beautician Arrives',
        'Expert arrives with 100% single-use sealed kits.', Color(0xFFC9A15A)),
    _StepData('4', 'Relax & Enjoy',
        'Premium salon experience in the comfort of your home.', Color(0xFF818CF8)),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: _steps
          .map((s) => _StepTile(step: s))
          .toList(),
    );
  }
}

class _StepData {
  final String number;
  final String title;
  final String desc;
  final Color accent;
  const _StepData(this.number, this.title, this.desc, this.accent);
}

class _StepTile extends StatelessWidget {
  final _StepData step;
  const _StepTile({required this.step});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF334155), width: 1),
        ),
        child: Row(
          children: [
            // Step number circle
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: step.accent.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  step.number,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: step.accent,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    step.title,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    step.desc,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
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

// ── Dark-themed Serviceability wrapper ───────────────────────────────────────

/// Wraps the existing [ServiceabilityWidget] in a dark-themed container
/// so it blends with the dark-scaffold home screen.
class _DarkServiceabilityWrapper extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        scaffoldBackgroundColor: const Color(0xFF1E293B),
        cardColor: const Color(0xFF1E293B),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF0F172A),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF334155)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF334155)),
          ),
          hintStyle: const TextStyle(color: Color(0xFF64748B)),
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF334155), width: 1),
        ),
        child: const ServiceabilityWidget(),
      ),
    );
  }
}
