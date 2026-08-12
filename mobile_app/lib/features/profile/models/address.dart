/// A saved delivery address — mirrors accounts.models.Address /
/// api/views.py::addresses_view's JSON shape.
class Address {
  final int id;
  final String label;
  final String text;
  final String pincode;
  final double? lat;
  final double? lng;

  Address({
    required this.id,
    required this.label,
    required this.text,
    required this.pincode,
    required this.lat,
    required this.lng,
  });

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: json['id'] as int,
        label: json['label'] as String,
        text: json['text'] as String,
        pincode: (json['pincode'] as String?) ?? '',
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
      );
}
