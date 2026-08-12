import '../../features/bookings/models/booking.dart';
import 'api_client.dart';

/// Signed-in-only bookings — GET /api/v1/bookings/, POST
/// /api/v1/bookings/checkout/, POST /api/v1/bookings/<n>/cancel/ (see
/// api/views.py). Requires an [ApiClient] carrying a valid token.
class BookingsRepository {
  final ApiClient _client;
  BookingsRepository(this._client);

  Future<List<Booking>> fetchBookings() async {
    final body = await _client.get('/api/v1/bookings/');
    return ((body['bookings'] as List?) ?? []).map((e) => Booking.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> cancelBooking(String bookingNumber) {
    return _client.post('/api/v1/bookings/$bookingNumber/cancel/', {});
  }

  /// [cart] entries look like `{'id': slug, 'qty': n, 'variantId': id?,
  /// 'included': {serviceId: variantId, ...}?}` — the exact shape
  /// `bookings.views._resolve_cart_pricing` (reused server-side by
  /// `api/views.py::checkout_view`) expects. Mobile v1 only supports
  /// `pay_at_home` — see the plan's scope boundaries.
  Future<String> checkout({
    required List<Map<String, dynamic>> cart,
    required String bookingType, // 'regular' | 'urgent'
    required DateTime date,
    String? timeSlot, // 'morning' | 'afternoon' | 'evening' — regular only
    String? exactTime, // 'HH:MM' — urgent only
    required Map<String, dynamic> address, // {label, text, pincode, lat?, lng?}
    String? couponCode,
  }) async {
    final body = await _client.post('/api/v1/bookings/checkout/', {
      'cart': cart,
      'booking_type': bookingType,
      'date': '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
      if (timeSlot != null) 'time_slot': timeSlot,
      if (exactTime != null) 'exact_time': exactTime,
      'address': address,
      'payment_method': 'pay-at-home',
      if (couponCode != null && couponCode.isNotEmpty) 'coupon_code': couponCode,
    });
    return body['booking_number'] as String;
  }
}
