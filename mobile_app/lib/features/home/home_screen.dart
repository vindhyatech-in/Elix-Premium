import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/catalog_repository.dart';
import '../../core/cart/cart_model.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/serviceability_widget.dart';
import '../catalog/catalog_screen.dart';
import '../catalog/models/catalog_item.dart';
import '../service_detail/service_detail_screen.dart';
import 'models/home_content.dart';
import 'widgets/hero_carousel.dart';
import 'widgets/home_top_bar.dart';

/// Home — mirrors the real web marketing landing page's own section
/// order (see core/views.py::index()), not a dashboard: hero carousel →
/// service categories → packages → how it works → before/after →
/// reviews → meet the team → trust/FAQs. Every section is real data
/// from GET /api/v1/home/ (+ the existing catalog endpoint for
/// packages) — nothing here is a placeholder.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _repo = CatalogRepository();
  bool _loading = true;
  String? _error;
  HomeContent? _content;
  List<CatalogItem> _packages = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([_repo.fetchHome(), _repo.fetchCatalog(kind: 'package')]);
      setState(() {
        _content = results[0] as HomeContent;
        _packages = results[1] as List<CatalogItem>;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  void _openCategory(LandingCategory category) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CatalogScreen(initialCategory: category.slug)));
  }

  void _openBrowseAll() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CatalogScreen()));
  }

  void _openItem(CatalogItem item) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ServiceDetailScreen(item: item)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: PreferredSize(preferredSize: const Size.fromHeight(64), child: const HomeTopBar()),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 16),
                            HeroCarousel(slides: _content!.slides),
                            const SizedBox(height: 16),
                            Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: const ServiceabilityWidget()),
                            const SizedBox(height: 24),

                            _SectionHeader(title: 'Explore Categories', onSeeAll: _openBrowseAll),
                            const SizedBox(height: 12),
                            _CategoryRow(categories: _content!.categories, onTap: _openCategory),
                            const SizedBox(height: 28),

                            if (_packages.isNotEmpty) ...[
                              _SectionHeader(title: 'Packages & Combos', onSeeAll: _openBrowseAll),
                              const SizedBox(height: 12),
                              _PackageRow(packages: _packages, onTap: _openItem),
                              const SizedBox(height: 28),
                            ],

                            if (_content!.howItWorks.isNotEmpty) ...[
                              const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _SectionHeader(title: 'How Elix Works')),
                              const SizedBox(height: 12),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: Column(children: _content!.howItWorks.map((s) => _StepTile(step: s)).toList()),
                              ),
                              const SizedBox(height: 28),
                            ],

                            if (_content!.beforeAfter.isNotEmpty) ...[
                              const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _SectionHeader(title: 'Real Transformations')),
                              const SizedBox(height: 12),
                              _BeforeAfterRow(items: _content!.beforeAfter),
                              const SizedBox(height: 28),
                            ],

                            if (_content!.testimonials.isNotEmpty) ...[
                              const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _SectionHeader(title: 'Loved By Our Customers')),
                              const SizedBox(height: 12),
                              _TestimonialRow(testimonials: _content!.testimonials),
                              const SizedBox(height: 28),
                            ],

                            if (_content!.beauticians.isNotEmpty) ...[
                              const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _SectionHeader(title: 'Meet Our Beauticians')),
                              const SizedBox(height: 12),
                              _BeauticianRow(beauticians: _content!.beauticians),
                              const SizedBox(height: 28),
                            ],

                            if (_content!.trustPoints.isNotEmpty) ...[
                              _TrustStrip(points: _content!.trustPoints),
                              const SizedBox(height: 28),
                            ],

                            if (_content!.faqs.isNotEmpty) ...[
                              const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _SectionHeader(title: 'Frequently Asked Questions')),
                              const SizedBox(height: 8),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: Column(children: _content!.faqs.map((f) => _FaqTile(faq: f)).toList()),
                              ),
                            ],

                            const SizedBox(height: 100),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}

// ── Shared bits ──────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onSeeAll;
  const _SectionHeader({required this.title, this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: onSeeAll != null ? 16 : 0, right: onSeeAll != null ? 16 : 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(fontFamily: 'Inter', fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.2)),
          if (onSeeAll != null)
            GestureDetector(
              onTap: onSeeAll,
              child: const Row(
                children: [
                  Text('See all', style: TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  SizedBox(width: 2),
                  Icon(Icons.arrow_forward_ios_rounded, size: 11, color: AppColors.primary),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 44, color: AppColors.textMuted),
            const SizedBox(height: 10),
            Text(message, textAlign: TextAlign.center, style: AppTheme.bodyMd),
            const SizedBox(height: 14),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

class _CategoryRow extends StatelessWidget {
  final List<LandingCategory> categories;
  final ValueChanged<LandingCategory> onTap;
  const _CategoryRow({required this.categories, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final cat = categories[i];
          return GestureDetector(
            onTap: () => onTap(cat),
            child: SizedBox(
              width: 68,
              child: Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.network(
                      cat.photoUrl,
                      width: 60,
                      height: 60,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(width: 60, height: 60, color: AppColors.primaryLight, child: const Icon(Icons.spa_rounded, color: AppColors.primary)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(cat.name, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: AppTheme.labelSm.copyWith(color: AppColors.textPrimary)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Packages ──────────────────────────────────────────────────────────────────

class _PackageRow extends StatelessWidget {
  final List<CatalogItem> packages;
  final ValueChanged<CatalogItem> onTap;
  const _PackageRow({required this.packages, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 210,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: packages.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) => _PackageCard(item: packages[i], onTap: () => onTap(packages[i])),
      ),
    );
  }
}

class _PackageCard extends StatelessWidget {
  final CatalogItem item;
  final VoidCallback onTap;
  const _PackageCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();
    final inCart = cart.lines.any((l) => l.item.id == item.id && l.variantId == null);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 160,
        decoration: AppTheme.cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              child: Image.network(item.photoUrl, height: 96, width: double.infinity, fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(height: 96, color: AppColors.primaryLight)),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text('₹${item.price.toStringAsFixed(0)}', style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary)),
                      if (item.mrp != null && item.mrp! > item.price) ...[
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text('₹${item.mrp!.toStringAsFixed(0)}',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textMuted, decoration: TextDecoration.lineThrough)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: inCart ? null : () => cart.add(item),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 6), minimumSize: const Size(0, 0)),
                      child: Text(inCart ? 'Added' : 'Add', style: const TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700)),
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

// ── How It Works ──────────────────────────────────────────────────────────────

class _StepTile extends StatelessWidget {
  final HowItWorksStepData step;
  const _StepTile({required this.step});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: AppTheme.cardDecoration(radius: 16),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
              child: Center(child: Text(step.step, style: const TextStyle(fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.primary))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(step.title, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(step.body, style: AppTheme.bodySm),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Before/After ──────────────────────────────────────────────────────────────

class _BeforeAfterRow extends StatelessWidget {
  final List<BeforeAfterData> items;
  const _BeforeAfterRow({required this.items});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 150,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final item = items[i];
          return SizedBox(
            width: 190,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Row(
                    children: [
                      Expanded(child: Image.network(item.beforePhotoUrl, height: 110, fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(height: 110, color: AppColors.primaryLight))),
                      const SizedBox(width: 2),
                      Expanded(child: Image.network(item.afterPhotoUrl, height: 110, fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(height: 110, color: AppColors.accentGreenLight))),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textPrimary)),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Testimonials ──────────────────────────────────────────────────────────────

class _TestimonialRow extends StatelessWidget {
  final List<TestimonialData> testimonials;
  const _TestimonialRow({required this.testimonials});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 170,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: testimonials.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final t = testimonials[i];
          return Container(
            width: 240,
            padding: const EdgeInsets.all(14),
            decoration: AppTheme.cardDecoration(radius: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: List.generate(5, (s) => Icon(Icons.star_rounded, size: 14, color: s < t.rating ? AppColors.accentGold : AppColors.borderLight))),
                const SizedBox(height: 8),
                Expanded(
                  child: Text('"${t.quote}"', maxLines: 4, overflow: TextOverflow.ellipsis, style: AppTheme.bodySm.copyWith(color: AppColors.textPrimary)),
                ),
                const SizedBox(height: 6),
                Text(t.name, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textPrimary)),
                Text('${t.service} · ${t.location}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTheme.bodySm.copyWith(fontSize: 11)),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Beauticians ───────────────────────────────────────────────────────────────

class _BeauticianRow extends StatelessWidget {
  final List<BeauticianData> beauticians;
  const _BeauticianRow({required this.beauticians});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 170,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: beauticians.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final b = beauticians[i];
          return Container(
            width: 130,
            padding: const EdgeInsets.all(12),
            decoration: AppTheme.cardDecoration(radius: 16),
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(40),
                  child: Image.network(b.photoUrl, width: 64, height: 64, fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(width: 64, height: 64, color: AppColors.primaryLight, child: const Icon(Icons.person_rounded, color: AppColors.primary))),
                ),
                const SizedBox(height: 8),
                Text(b.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textPrimary)),
                Text(b.specialties, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTheme.bodySm.copyWith(fontSize: 11)),
                const SizedBox(height: 4),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.star_rounded, size: 12, color: AppColors.accentGold),
                  const SizedBox(width: 2),
                  Text(b.rating.toStringAsFixed(1), style: const TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                ]),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Trust strip + FAQs ────────────────────────────────────────────────────────

class _TrustStrip extends StatelessWidget {
  final List<TrustPointData> points;
  const _TrustStrip({required this.points});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: points
            .map((p) => Expanded(
                  child: Column(
                    children: [
                      Text('${p.value.toStringAsFixed(p.value.truncateToDouble() == p.value ? 0 : 1)}${p.suffix}',
                          style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.primary)),
                      const SizedBox(height: 2),
                      Text(p.label, textAlign: TextAlign.center, maxLines: 2, style: AppTheme.labelSm),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  final FaqData faq;
  const _FaqTile({required this.faq});

  @override
  Widget build(BuildContext context) {
    // ExpansionTile paints its ListTile's background/ink splashes on
    // the nearest Material ancestor — a plain Container with its own
    // background color here would hide both, so the border/shadow live
    // on this transparent outer Container while an inner Material owns
    // the fill color the ListTile actually paints onto.
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
        boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Material(
        color: AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(horizontal: 14),
            childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            title: Text(faq.question, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
            children: [Align(alignment: Alignment.centerLeft, child: Text(faq.answer, style: AppTheme.bodySm))],
          ),
        ),
      ),
    );
  }
}
