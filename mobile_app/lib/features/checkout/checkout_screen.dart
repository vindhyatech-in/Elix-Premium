import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/bookings_repository.dart';
import '../../core/api/profile_repository.dart';
import '../../core/auth/auth_service.dart';
import '../../core/cart/cart_model.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../profile/models/address.dart';

/// Checkout — mirrors booking_drawer.html's fields/flow (Address, Date,
/// Booking Type + Slot, Payment, Summary) as one scrollable form rather
/// than a literal multi-step wizard, which suits a phone screen better
/// without changing what's actually collected or how it's priced.
/// Mobile v1 only offers Pay At Home — see the plan's scope boundaries.
class CheckoutScreen extends StatefulWidget {
  final String couponCode;
  final String initialBookingType;
  const CheckoutScreen({super.key, this.couponCode = '', this.initialBookingType = 'regular'});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  late final ProfileRepository _profileRepo;
  late final BookingsRepository _bookingsRepo;

  bool _loadingAddresses = true;
  List<Address> _addresses = [];
  Address? _selectedAddress;
  bool _showAddForm = false;
  final _labelCtrl = TextEditingController(text: 'Home');
  final _textCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();

  DateTime _date = DateTime.now();
  late String _bookingType = widget.initialBookingType;
  String? _timeSlot;
  TimeOfDay? _urgentTime;

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final client = context.read<AuthService>().client();
    _profileRepo = ProfileRepository(client);
    _bookingsRepo = BookingsRepository(client);
    _loadAddresses();
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    _textCtrl.dispose();
    _pincodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAddresses() async {
    setState(() => _loadingAddresses = true);
    try {
      final addresses = await _profileRepo.fetchAddresses();
      setState(() {
        _addresses = addresses;
        _selectedAddress ??= addresses.isNotEmpty ? addresses.first : null;
        _loadingAddresses = false;
      });
    } on ApiException {
      setState(() => _loadingAddresses = false);
    }
  }

  Future<void> _saveAddress() async {
    if (_textCtrl.text.trim().isEmpty) return;
    try {
      final address = await _profileRepo.addAddress(
        label: _labelCtrl.text.trim().isEmpty ? 'Address' : _labelCtrl.text.trim(),
        text: _textCtrl.text.trim(),
        pincode: _pincodeCtrl.text.trim(),
      );
      setState(() {
        _addresses = [..._addresses, address];
        _selectedAddress = address;
        _showAddForm = false;
        _textCtrl.clear();
        _pincodeCtrl.clear();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  DateTime get _minUrgentDateTime => DateTime.now().add(const Duration(minutes: 50));

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickUrgentTime() async {
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_minUrgentDateTime));
    if (picked != null) setState(() => _urgentTime = picked);
  }

  bool get _isToday {
    final now = DateTime.now();
    return _date.year == now.year && _date.month == now.month && _date.day == now.day;
  }

  String? _validate() {
    if (_selectedAddress == null) return 'Select or add a delivery address.';
    if (_bookingType == 'regular' && _timeSlot == null) return 'Select a time slot.';
    if (_bookingType == 'urgent' && _urgentTime == null) return 'Select an express time.';
    if (_bookingType == 'urgent' && _isToday) {
      final chosen = DateTime(_date.year, _date.month, _date.day, _urgentTime!.hour, _urgentTime!.minute);
      if (chosen.isBefore(_minUrgentDateTime)) {
        return 'Urgent bookings for today must be at least 50 minutes from now.';
      }
    }
    return null;
  }

  Future<void> _confirm() async {
    final cart = context.read<CartModel>();
    final validationError = _validate();
    if (validationError != null) {
      setState(() => _error = validationError);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final bookingNumber = await _bookingsRepo.checkout(
        cart: cart.lines.map((l) => l.toCartPayload()).toList(),
        bookingType: _bookingType,
        date: _date,
        timeSlot: _bookingType == 'regular' ? _timeSlot : null,
        exactTime: _bookingType == 'urgent'
            ? '${_urgentTime!.hour.toString().padLeft(2, '0')}:${_urgentTime!.minute.toString().padLeft(2, '0')}'
            : null,
        address: {
          'label': _selectedAddress!.label,
          'text': _selectedAddress!.text,
          'pincode': _selectedAddress!.pincode,
          if (_selectedAddress!.lat != null) 'lat': _selectedAddress!.lat,
          if (_selectedAddress!.lng != null) 'lng': _selectedAddress!.lng,
        },
        couponCode: widget.couponCode,
      );
      cart.clear();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => _ConfirmationScreen(bookingNumber: bookingNumber)));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.cardLight,
        elevation: 0,
        title: const Text('Checkout', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const _SectionTitle('Delivery Address'),
          if (_loadingAddresses)
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: CircularProgressIndicator(color: AppColors.primary))
          else ...[
            ..._addresses.map((a) => RadioListTile<Address>(
                  value: a,
                  groupValue: _selectedAddress,
                  onChanged: (v) => setState(() => _selectedAddress = v),
                  title: Text(a.label, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: Text(a.text, style: AppTheme.bodySm),
                  activeColor: AppColors.primary,
                  contentPadding: EdgeInsets.zero,
                )),
            TextButton.icon(
              onPressed: () => setState(() => _showAddForm = !_showAddForm),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add New Address'),
            ),
            if (_showAddForm)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.cardLight, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.borderLight)),
                child: Column(
                  children: [
                    TextField(controller: _labelCtrl, decoration: const InputDecoration(hintText: 'Label (Home, Office…)')),
                    const SizedBox(height: 8),
                    TextField(controller: _textCtrl, maxLines: 2, decoration: const InputDecoration(hintText: 'Full address')),
                    const SizedBox(height: 8),
                    TextField(controller: _pincodeCtrl, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(hintText: 'Pincode')),
                    const SizedBox(height: 8),
                    SizedBox(width: double.infinity, child: ElevatedButton(onPressed: _saveAddress, child: const Text('Save Address'))),
                  ],
                ),
              ),
          ],
          const _SectionTitle('Date'),
          OutlinedButton.icon(
            onPressed: _pickDate,
            icon: const Icon(Icons.calendar_today_rounded, size: 16),
            label: Text('${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}'),
          ),
          const _SectionTitle('Booking Type'),
          Row(children: [
            Expanded(child: _TypeChip(label: 'Regular', selected: _bookingType == 'regular', onTap: () => setState(() => _bookingType = 'regular'))),
            const SizedBox(width: 8),
            Expanded(child: _TypeChip(label: 'Urgent', selected: _bookingType == 'urgent', onTap: () => setState(() => _bookingType = 'urgent'))),
          ]),
          const SizedBox(height: 12),
          if (_bookingType == 'regular')
            Row(
              children: [
                Expanded(child: _SlotCard(label: 'Morning', sub: '8 AM – 12 PM', selected: _timeSlot == 'morning', onTap: () => setState(() => _timeSlot = 'morning'))),
                const SizedBox(width: 8),
                Expanded(child: _SlotCard(label: 'Afternoon', sub: '12 PM – 4 PM', selected: _timeSlot == 'afternoon', onTap: () => setState(() => _timeSlot = 'afternoon'))),
                const SizedBox(width: 8),
                Expanded(child: _SlotCard(label: 'Evening', sub: '4 PM – 8 PM', selected: _timeSlot == 'evening', onTap: () => setState(() => _timeSlot = 'evening'))),
              ],
            )
          else
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.accentGreenLight, borderRadius: BorderRadius.circular(12)),
                  child: const Text('⚡ Express Service Guarantee: arrives within 50 minutes of your selected time.',
                      style: TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.accentGreen)),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _pickUrgentTime,
                  icon: const Icon(Icons.access_time_rounded, size: 16),
                  label: Text(_urgentTime == null ? 'Select express time' : _urgentTime!.format(context)),
                ),
              ],
            ),
          const _SectionTitle('Payment'),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.primary, width: 1.5)),
            child: Row(children: const [
              Icon(Icons.home_rounded, color: AppColors.primary),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Pay At Home', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                    Text('Cash or UPI to the artist', style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              Icon(Icons.check_circle_rounded, color: AppColors.primary),
            ]),
          ),
          const _SectionTitle('Summary'),
          ...cart.lines.map((l) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  Expanded(child: Text('${l.item.name} × ${l.qty}', style: AppTheme.bodyMd)),
                  Text('₹${l.lineTotal.toStringAsFixed(0)}', style: AppTheme.bodyMd.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                ]),
              )),
          if (widget.couponCode.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text('Coupon "${widget.couponCode}" will be applied if valid.', style: AppTheme.bodySm),
            ),
          const Divider(height: 24),
          Row(
            children: [
              const Text('Total', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary)),
              const Spacer(),
              Text('₹${cart.subtotal.toStringAsFixed(0)}', style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary)),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(fontFamily: 'Inter', color: Color(0xFFDC2626), fontSize: 13)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting || cart.isEmpty ? null : _confirm,
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Confirm Booking'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Text(text, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.textPrimary)),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TypeChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.bgLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight),
        ),
        child: Text(label, style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13, color: selected ? Colors.white : AppColors.textPrimary)),
      ),
    );
  }
}

class _SlotCard extends StatelessWidget {
  final String label;
  final String sub;
  final bool selected;
  final VoidCallback onTap;
  const _SlotCard({required this.label, required this.sub, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryLight : AppColors.cardLight,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight, width: selected ? 1.5 : 1),
        ),
        child: Column(children: [
          Text(label, textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textPrimary)),
          const SizedBox(height: 2),
          Text(sub, textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'Inter', fontSize: 10, color: AppColors.textSecondary)),
        ]),
      ),
    );
  }
}

class _ConfirmationScreen extends StatelessWidget {
  final String bookingNumber;
  const _ConfirmationScreen({required this.bookingNumber});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_rounded, color: AppColors.accentGreen, size: 64),
              const SizedBox(height: 16),
              const Text('Booking Confirmed!', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary)),
              const SizedBox(height: 8),
              Text('Your booking ID is $bookingNumber.', style: AppTheme.bodyMd, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                child: const Text('Done'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
