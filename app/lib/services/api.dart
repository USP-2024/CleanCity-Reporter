import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);

  @override
  String toString() => message;
}

/// Thin wrapper around the REST API. Adds the JWT token to every request and
/// turns server errors into an [ApiException] with a readable message.
class Api {
  static String? token;

  static Map<String, String> _headers({bool json = true}) => {
    if (json) 'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  static Uri _uri(String path, [Map<String, String>? query]) {
    final uri = Uri.parse('$apiUrl$path');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(queryParameters: query);
  }

  static dynamic _decode(http.Response res) {
    dynamic body;
    if (res.body.isNotEmpty) {
      try {
        body = jsonDecode(res.body);
      } catch (_) {
        body = null;
      }
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    if (body is Map && body['message'] != null) {
      throw ApiException(body['message'].toString());
    }
    throw ApiException('Request failed (${res.statusCode})');
  }

  static Future<dynamic> _send(Future<http.Response> Function() call) async {
    http.Response res;
    try {
      res = await call().timeout(const Duration(seconds: 30));
    } catch (_) {
      throw ApiException(
        'Cannot reach the server. Check that the backend is running and that baseUrl in config.dart is correct.',
      );
    }
    return _decode(res);
  }

  static Future<dynamic> get(String path, {Map<String, String>? query}) =>
      _send(() => http.get(_uri(path, query), headers: _headers()));

  static Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _send(
        () => http.post(
          _uri(path),
          headers: _headers(),
          body: jsonEncode(body ?? {}),
        ),
      );

  static Future<dynamic> put(String path, Map<String, dynamic> body) => _send(
    () => http.put(_uri(path), headers: _headers(), body: jsonEncode(body)),
  );

  static Future<dynamic> patch(String path, [Map<String, dynamic>? body]) =>
      _send(
        () => http.patch(
          _uri(path),
          headers: _headers(),
          body: jsonEncode(body ?? {}),
        ),
      );

  static Future<dynamic> delete(String path) =>
      _send(() => http.delete(_uri(path), headers: _headers()));

  /// Uploads a photo + text fields as multipart/form-data.
  static Future<dynamic> upload(
    String path, {
    required Map<String, String> fields,
    required String filePath,
  }) {
    return _send(() async {
      final req = http.MultipartRequest('POST', _uri(path));
      req.headers.addAll(_headers(json: false));
      req.fields.addAll(fields);
      req.files.add(await http.MultipartFile.fromPath('photo', filePath));
      final streamed = await req.send();
      return http.Response.fromStream(streamed);
    });
  }
}
