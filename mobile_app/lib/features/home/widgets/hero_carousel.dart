import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/home_content.dart';

/// Auto-rotating hero carousel — slide 1 is always the singleton `Hero`
/// row ("Elix info"), slides 2+ are admin-added `PromoBanner` rows (any
/// offer/special service) — see [HomeContent.slides]. Auto-advances
/// every 4s, pauses while the user is actively dragging, loops back to
/// the first slide after the last.
class HeroCarousel extends StatefulWidget {
  final List<CarouselSlide> slides;
  const HeroCarousel({super.key, required this.slides});

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  late final PageController _controller = PageController();
  Timer? _timer;
  int _page = 0;
  bool _userInteracting = false;

  @override
  void initState() {
    super.initState();
    if (widget.slides.length > 1) _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_userInteracting || !_controller.hasClients) return;
      final next = (_page + 1) % widget.slides.length;
      _controller.animateToPage(next, duration: const Duration(milliseconds: 500), curve: Curves.easeInOut);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slides.isEmpty) return const SizedBox.shrink();

    return Listener(
      onPointerDown: (_) => _userInteracting = true,
      onPointerUp: (_) => Future.delayed(const Duration(seconds: 2), () => _userInteracting = false),
      child: SizedBox(
        height: 190,
        child: Stack(
          children: [
            PageView.builder(
              controller: _controller,
              itemCount: widget.slides.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => _SlideCard(slide: widget.slides[i]),
            ),
            if (widget.slides.length > 1)
              Positioned(
                bottom: 12,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    widget.slides.length,
                    (i) => AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _page ? 18 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == _page ? Colors.white : Colors.white.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SlideCard extends StatelessWidget {
  final CarouselSlide slide;
  const _SlideCard({required this.slide});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              slide.photoUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(color: AppColors.primaryDark),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Colors.black.withValues(alpha: 0.65), Colors.transparent],
                ),
              ),
            ),
            Positioned(
              left: 18,
              right: 18,
              bottom: 26,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    slide.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 20, color: Colors.white, height: 1.15),
                  ),
                  if (slide.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      slide.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: Colors.white.withValues(alpha: 0.85)),
                    ),
                  ],
                  if (slide.ctaLabel.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: Text(slide.ctaLabel, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 11, color: AppColors.primary)),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
