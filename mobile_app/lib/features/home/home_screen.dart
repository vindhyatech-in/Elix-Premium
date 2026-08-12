import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/catalog_repository.dart';
import '../../core/auth/auth_service.dart';
import '../../core/constants/app_colors.dart';
import '../auth/login_screen.dart';
import '../catalog/catalog_screen.dart';
import '../catalog/models/catalog_item.dart';
import '../checkout/checkout_screen.dart';
import '../../widgets/serviceability_widget.dart';
import 'widgets/category_grid.dart';
import 'widgets/hero_banner.dart';
import 'widgets/home_top_bar.dart';
import 'widgets/trust_strip.dart';

/// Main home screen — dark background, scrollable column of sections.
/// The hero/trust-strip/how-it-works copy is static marketing content
/// (no API backs it — see the plan's scope boundaries); the category
/// grid is real data and is this screen's entry point into the catalog
/// (services_booking's role on the web), since Home isn't itself a
/// catalog listing the way the web's bottom-nav "Home" link is.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _repo = CatalogRepository();
  List<CatalogCategory> _categories = [];

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await _repo.fetchCategories();
      if (mounted) setState(() => _categories = categories);
    } on ApiException {
      // Home degrades gracefully — an empty category grid, not a crash
      // or an error banner, on a section that's a shortcut, not the
      // only way to reach the catalog (see _onBrowseServices).
    }
  }

  void _onBookExpress() {
    if (!context.read<AuthService>().isLoggedIn) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => LoginScreen(onSuccess: () => Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const CheckoutScreen(initialBookingType: 'urgent')),
            )),
      ));
      return;
    }
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CheckoutScreen(initialBookingType: 'urgent')));
  }

  void _onBrowseServices() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CatalogScreen()));
  }

  void _onCategoryTap(CatalogCategory category) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CatalogScreen(initialCategory: category.slug)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
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
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: HeroBanner(
                    onBookExpress: _onBookExpress,
                    onBrowseServices: _onBrowseServices,
                  ),
                ),
                const SizedBox(height: 20),
                const TrustStrip(),
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Explore Salon Services',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.3),
                      ),
                      GestureDetector(
                        onTap: _onBrowseServices,
                        child: const Row(
                          children: [
                            Text('See all', style: TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF818CF8))),
                            SizedBox(width: 2),
                            Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Color(0xFF818CF8)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                CategoryGrid(categories: _categories, onTap: _onCategoryTap),
                const SizedBox(height: 24),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'How Elix Works',
                    style: TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.3),
                  ),
                ),
                const SizedBox(height: 12),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: _HowItWorksSection(),
                ),
                const SizedBox(height: 24),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: _DarkServiceabilityWrapper(),
                ),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HowItWorksSection extends StatelessWidget {
  const _HowItWorksSection();

  static const _steps = [
    _StepData('1', 'Choose Your Ritual', 'Browse single services or curated packages.', Color(0xFF4F46E5)),
    _StepData('2', 'Select Time & Address', 'Pick a scheduled slot or 50-Min urgent delivery.', Color(0xFF059669)),
    _StepData('3', 'Beautician Arrives', 'Expert arrives with 100% single-use sealed kits.', Color(0xFFC9A15A)),
    _StepData('4', 'Relax & Enjoy', 'Premium salon experience in the comfort of your home.', Color(0xFF818CF8)),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(children: _steps.map((s) => _StepTile(step: s)).toList());
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
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: step.accent.withValues(alpha: 0.15), shape: BoxShape.circle),
              child: Center(
                child: Text(step.number, style: TextStyle(fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w800, color: step.accent)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(step.title, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14, color: Colors.white)),
                  const SizedBox(height: 2),
                  Text(step.desc, style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: Color(0xFF94A3B8))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DarkServiceabilityWrapper extends StatelessWidget {
  const _DarkServiceabilityWrapper();

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        scaffoldBackgroundColor: const Color(0xFF1E293B),
        cardColor: const Color(0xFF1E293B),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF0F172A),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF334155))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF334155))),
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
