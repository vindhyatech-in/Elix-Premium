import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/bookings_repository.dart';
import '../../core/auth/auth_service.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/status_badge.dart';
import '../auth/login_screen.dart';
import 'models/booking.dart';

const _tabs = ['all', 'upcoming', 'completed', 'cancelled'];
const _tabLabels = ['All', 'Upcoming', 'Completed', 'Cancelled'];

BookingStatus _statusFromString(String s) {
  switch (s) {
    case 'on_the_way':
      return BookingStatus.onWay;
    case 'in_progress':
      return BookingStatus.inProgress;
    case 'completed':
      return BookingStatus.completed;
    case 'cancelled':
      return BookingStatus.cancelled;
    default:
      return BookingStatus.upcoming;
  }
}

/// The Bookings bottom-nav tab — mirrors
/// templates/booking/pages/bookings_dashboard.html: status tabs +
/// booking cards with items/address/total/Cancel. Signed-out visitors
/// see a sign-in prompt instead (this screen requires a token).
class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});

  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  bool _loading = false;
  bool _loadedForSession = false;
  String? _error;
  List<Booking> _bookings = [];
  String _tab = 'all';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = BookingsRepository(context.read<AuthService>().client());
      final bookings = await repo.fetchBookings();
      setState(() {
        _bookings = bookings;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _cancel(Booking booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel booking?'),
        content: Text('Cancel ${booking.bookingNumber}? This can\'t be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('No')),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Yes, cancel')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      final repo = BookingsRepository(context.read<AuthService>().client());
      await repo.cancelBooking(booking.bookingNumber);
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  List<Booking> get _filtered {
    switch (_tab) {
      case 'upcoming':
        return _bookings.where((b) => ['upcoming', 'on_the_way', 'in_progress'].contains(b.status)).toList();
      case 'completed':
        return _bookings.where((b) => b.status == 'completed').toList();
      case 'cancelled':
        return _bookings.where((b) => b.status == 'cancelled').toList();
      default:
        return _bookings;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (!auth.isLoggedIn) {
      _loadedForSession = false;
      return Scaffold(
        backgroundColor: AppColors.bgLight,
        appBar: AppBar(backgroundColor: AppColors.cardLight, elevation: 0, title: const Text('My Bookings', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, color: AppColors.textPrimary))),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.event_note_rounded, size: 48, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('Sign in to view your bookings', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen())),
                  child: const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (!_loadedForSession) {
      _loadedForSession = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }

    final filtered = _filtered;

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.cardLight,
        elevation: 0,
        title: const Text('My Bookings', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(child: Text(_error!, style: AppTheme.bodyMd))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: Column(
                    children: [
                      SizedBox(
                        height: 44,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          itemCount: _tabs.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 8),
                          itemBuilder: (context, i) {
                            final selected = _tab == _tabs[i];
                            return GestureDetector(
                              onTap: () => setState(() => _tab = _tabs[i]),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: selected ? AppColors.primary : AppColors.bgLight,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight),
                                ),
                                child: Text(_tabLabels[i],
                                    style: TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? Colors.white : AppColors.textSecondary)),
                              ),
                            );
                          },
                        ),
                      ),
                      Expanded(
                        child: filtered.isEmpty
                            ? ListView(children: const [
                                SizedBox(height: 80),
                                Center(child: Text('No bookings here yet.', style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary))),
                              ])
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                                itemCount: filtered.length,
                                separatorBuilder: (_, _) => const SizedBox(height: 12),
                                itemBuilder: (context, i) => _BookingCard(booking: filtered[i], onCancel: () => _cancel(filtered[i])),
                              ),
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final Booking booking;
  final VoidCallback onCancel;
  const _BookingCard({required this.booking, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    final d = booking.scheduledDate;
    final dateLabel = '${d.day}/${d.month}/${d.year}';
    final timeLabel = booking.bookingType == 'urgent' ? '${booking.exactTime} (Urgent)' : (booking.timeSlotDisplay ?? '');

    return Container(
      decoration: AppTheme.cardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(booking.bookingNumber, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary)),
                    const SizedBox(height: 2),
                    Text('$dateLabel · $timeLabel', style: AppTheme.bodySm),
                  ],
                ),
              ),
              StatusBadge(status: _statusFromString(booking.status), compact: true),
            ],
          ),
          if (booking.startOtp != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: AppColors.accentGreenLight, borderRadius: BorderRadius.circular(8)),
              child: Text('Beautician arrived — share this code: ${booking.startOtp}',
                  style: const TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.accentGreen)),
            ),
          ],
          const SizedBox(height: 10),
          ...booking.items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Row(
                  children: [
                    Expanded(child: Text('${item.name} × ${item.quantity}', style: AppTheme.bodySm)),
                    Text('₹${item.price.toStringAsFixed(0)}', style: AppTheme.bodySm.copyWith(fontWeight: FontWeight.w600)),
                  ],
                ),
              )),
          const Divider(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_rounded, size: 14, color: AppColors.textMuted),
              const SizedBox(width: 4),
              Expanded(
                  child: Text('${booking.addressLabel} — ${booking.addressText}',
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTheme.bodySm)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total ₹${booking.totalAmount.toStringAsFixed(0)}',
                  style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary)),
              if (booking.canCancel)
                TextButton(
                  onPressed: onCancel,
                  style: TextButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
                  child: const Text('Cancel'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
