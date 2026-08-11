import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/constants/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/home/home_screen.dart';
import 'features/catalog/catalog_screen.dart';
import 'widgets/elix_bottom_nav.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Force dark status bar on home screen (overridden per screen as needed)
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const ElixApp());
}

class ElixApp extends StatelessWidget {
  const ElixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Elix',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      // Use system theme preference — no manual toggle needed
      themeMode: ThemeMode.system,
      home: const _ElixShell(),
    );
  }
}

/// Root shell: manages bottom-nav tab switching.
class _ElixShell extends StatefulWidget {
  const _ElixShell();

  @override
  State<_ElixShell> createState() => _ElixShellState();
}

class _ElixShellState extends State<_ElixShell> {
  int _currentIndex = 0;

  // Keep all screens alive (IndexedStack) so state isn't lost on tab switch
  final _screens = const [
    HomeScreen(),
    CatalogScreen(),      // Bookings tab → show catalog for now
    _ComingSoonScreen(label: 'Offers'),
    _ComingSoonScreen(label: 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // IndexedStack keeps screen state across tab switches
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: ElixBottomNav(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
      ),
    );
  }
}

// ── Placeholder for unbuilt tabs ─────────────────────────────────────────────

class _ComingSoonScreen extends StatelessWidget {
  final String label;
  const _ComingSoonScreen({required this.label});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.construction_rounded,
                color: AppColors.primary,
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              label,
              style: AppTheme.headingMd,
            ),
            const SizedBox(height: 6),
            Text(
              'Coming soon…',
              style: AppTheme.bodyMd,
            ),
          ],
        ),
      ),
    );
  }
}
