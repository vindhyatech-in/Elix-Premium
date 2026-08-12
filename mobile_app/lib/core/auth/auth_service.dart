import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';

/// Session state shared across every screen via Provider — mirrors what
/// the web app keeps in its Django session, except here it's a bearer
/// token persisted to `shared_preferences` (see api/views.py::auth_login
/// / api/auth.py::token_required on the Django side).
class AuthService extends ChangeNotifier {
  static const _tokenKey = 'auth_token';
  static const _emailKey = 'auth_email';

  String? _token;
  String? _email;
  bool _ready = false;

  String? get token => _token;
  String? get email => _email;
  bool get isLoggedIn => _token != null;
  bool get ready => _ready;

  /// An [ApiClient] carrying the current token (or none, if logged out)
  /// — every repository builds requests through one of these.
  ApiClient client() => ApiClient(token: _token);

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    _email = prefs.getString(_emailKey);
    _ready = true;
    notifyListeners();
  }

  Future<void> login(String identifier, String password) async {
    final body = await ApiClient().post('/api/v1/auth/login/', {
      'identifier': identifier,
      'password': password,
    });
    final token = body['token'] as String;
    final email = (body['user'] as Map<String, dynamic>)['email'] as String? ?? identifier;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_emailKey, email);

    _token = token;
    _email = email;
    notifyListeners();
  }

  Future<void> logout() async {
    if (_token != null) {
      try {
        await client().post('/api/v1/auth/logout/', {});
      } catch (_) {
        // Best-effort — the local token is cleared regardless so the
        // app treats the user as signed out even if this call fails
        // (e.g. offline).
      }
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_emailKey);
    _token = null;
    _email = null;
    notifyListeners();
  }
}
