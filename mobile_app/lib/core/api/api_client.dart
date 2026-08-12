import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

/// Thin wrapper the mobile app's `api/` calls all funnel through — one
/// place that attaches the bearer token, decodes JSON, and turns any
/// failure (network, non-2xx, or a well-formed `{"ok": false, ...}`
/// body — see api/views.py, every mutating endpoint returns that shape
/// on failure) into a single exception type callers can catch once.
class ApiException implements Exception {
  final String message;
  ApiException(this.message);

  @override
  String toString() => message;
}

class ApiClient {
  final String? token;

  const ApiClient({this.token});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Token $token',
      };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('${ApiConfig.baseUrl}$path').replace(queryParameters: query);

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body;
    try {
      body = res.body.isEmpty ? {} : jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException('Unexpected server response (${res.statusCode}).');
    }
    final ok = body['ok'];
    if (res.statusCode < 200 || res.statusCode >= 300 || ok == false) {
      throw ApiException((body['error'] as String?) ?? 'Something went wrong. Please try again.');
    }
    return body;
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    try {
      final res = await http.get(_uri(path, query), headers: _headers);
      return _decode(res);
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException("Couldn't reach the server — check your connection.");
    }
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    try {
      final res = await http.post(_uri(path), headers: _headers, body: jsonEncode(body));
      return _decode(res);
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException("Couldn't reach the server — check your connection.");
    }
  }

  Future<Map<String, dynamic>> delete(String path) async {
    try {
      final res = await http.delete(_uri(path), headers: _headers);
      return _decode(res);
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException("Couldn't reach the server — check your connection.");
    }
  }
}
