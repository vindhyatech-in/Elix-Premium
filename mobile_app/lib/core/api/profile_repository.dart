import '../../features/profile/models/address.dart';
import 'api_client.dart';

class ProfileData {
  final String email;
  final String firstName;
  final String lastName;
  final String phone;

  ProfileData({required this.email, required this.firstName, required this.lastName, required this.phone});
}

/// Signed-in-only profile/address data — GET/POST /api/v1/profile/,
/// /api/v1/addresses/, DELETE /api/v1/addresses/<id>/ (see api/views.py).
/// Requires an [ApiClient] carrying a valid token — build one via
/// `AuthService.client()`.
class ProfileRepository {
  final ApiClient _client;
  ProfileRepository(this._client);

  Future<ProfileData> fetchProfile() async {
    final body = await _client.get('/api/v1/profile/');
    final user = body['user'] as Map<String, dynamic>;
    return ProfileData(
      email: user['email'] as String,
      firstName: (user['first_name'] as String?) ?? '',
      lastName: (user['last_name'] as String?) ?? '',
      phone: (body['phone'] as String?) ?? '',
    );
  }

  Future<void> updateProfile({required String firstName, required String lastName, required String phone}) {
    return _client.post('/api/v1/profile/', {
      'first_name': firstName,
      'last_name': lastName,
      'phone': phone,
    });
  }

  Future<List<Address>> fetchAddresses() async {
    final body = await _client.get('/api/v1/addresses/');
    return ((body['addresses'] as List?) ?? []).map((e) => Address.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Address> addAddress({required String label, required String text, String pincode = ''}) async {
    final body = await _client.post('/api/v1/addresses/', {
      'label': label,
      'text': text,
      'pincode': pincode,
    });
    return Address.fromJson(body['address'] as Map<String, dynamic>);
  }

  Future<void> deleteAddress(int id) {
    return _client.delete('/api/v1/addresses/$id/');
  }
}
