import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'core/api/catalog_repository.dart';
import 'core/auth/auth_service.dart';
import 'core/cart/cart_model.dart';
import 'core/constants/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/home/home_screen.dart';
import 'features/bookings/my_bookings_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/cart/cart_sheet.dart';
import 'widgets/elix_bottom_nav.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()..restore()),
        ChangeNotifierProvider(create: (_) => CartModel()),
      ],
      child: const ElixApp(),
    ),
  );
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
      themeMode: ThemeMode.system,
      home: const _ElixShell(),
    );
  }
}

/// Root shell: manages bottom-nav tab switching. Mirrors the real
/// mobile web nav (templates/booking/components/bottom_nav.html) — Home
/// / Bookings / Cart / Profile, where Cart is an overlay sheet, not a
/// fourth page, so it never changes [_currentIndex].
class _ElixShell extends StatefulWidget {
  const _ElixShell();

  @override
  State<_ElixShell> createState() => _ElixShellState();
}

class _ElixShellState extends State<_ElixShell> {
  int _currentIndex = 0;

  final _screens = const [
    HomeScreen(),
    MyBookingsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    // Persisted cart lines only carry a catalog id (see
    // CartModel._persist) — resolving them back into full CatalogItems
    // needs one catalog fetch, done once here rather than per-screen.
    CatalogRepository().fetchCatalog().then((catalog) {
      if (mounted) context.read<CartModel>().restore(catalog);
    }).catchError((_) {
      // Offline on launch — the cart just starts empty; nothing to
      // recover without a catalog to resolve saved ids against.
    });
  }

  void _openCart() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CartSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    if (!authService.ready) {
      return const Scaffold(
        backgroundColor: AppColors.bgDark,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    return Scaffold(
      body: IndexedStack(
        // _currentIndex is 0/1/2 for Home/Bookings/Profile — the nav's
        // Cart tab (index 2 in its own 4-item layout) never lands here.
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: ElixBottomNav(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        onCartTap: _openCart,
      ),
    );
  }
}
