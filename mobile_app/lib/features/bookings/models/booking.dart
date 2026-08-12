/// One booking line item — a frozen name/price snapshot, same reasoning
/// as bookings.models.BookingItem (a later catalog price change must
/// never alter a past booking's receipt).
class BookingLineItem {
  final String name;
  final double price;
  final int quantity;
  final List<dynamic> included;

  BookingLineItem({required this.name, required this.price, required this.quantity, required this.included});

  factory BookingLineItem.fromJson(Map<String, dynamic> json) => BookingLineItem(
        name: json['name'] as String,
        price: (json['price'] as num).toDouble(),
        quantity: json['quantity'] as int,
        included: (json['included'] as List?) ?? [],
      );
}

/// Mirrors api/views.py::bookings_view's per-booking JSON shape.
class Booking {
  final String bookingNumber;
  final String status;
  final String statusDisplay;
  final DateTime scheduledDate;
  final String bookingType;
  final String? timeSlot;
  final String? timeSlotDisplay;
  final String? exactTime;
  final String addressLabel;
  final String addressText;
  final String paymentMethod;
  final String paymentStatus;
  final double subtotal;
  final double discountAmount;
  final double totalAmount;
  final bool canCancel;
  final String? startOtp;
  final List<BookingLineItem> items;

  Booking({
    required this.bookingNumber,
    required this.status,
    required this.statusDisplay,
    required this.scheduledDate,
    required this.bookingType,
    required this.timeSlot,
    required this.timeSlotDisplay,
    required this.exactTime,
    required this.addressLabel,
    required this.addressText,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.subtotal,
    required this.discountAmount,
    required this.totalAmount,
    required this.canCancel,
    required this.startOtp,
    required this.items,
  });

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
        bookingNumber: json['booking_number'] as String,
        status: json['status'] as String,
        statusDisplay: json['status_display'] as String,
        scheduledDate: DateTime.parse(json['scheduled_date'] as String),
        bookingType: json['booking_type'] as String,
        timeSlot: json['time_slot'] as String?,
        timeSlotDisplay: json['time_slot_display'] as String?,
        exactTime: json['exact_time'] as String?,
        addressLabel: json['address_label'] as String,
        addressText: json['address_text'] as String,
        paymentMethod: json['payment_method'] as String,
        paymentStatus: json['payment_status'] as String,
        subtotal: (json['subtotal'] as num).toDouble(),
        discountAmount: (json['discount_amount'] as num).toDouble(),
        totalAmount: (json['total_amount'] as num).toDouble(),
        canCancel: json['can_cancel'] as bool,
        startOtp: json['start_otp'] as String?,
        items: ((json['items'] as List?) ?? [])
            .map((e) => BookingLineItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
