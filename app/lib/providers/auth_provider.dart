import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import '../services/api.dart';

class AuthProvider extends ChangeNotifier {
  AppUser? user;
  bool loading = true;

  /// Called once at app start: restores the saved login (JWT) if there is one.
  Future<void> tryAutoLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('token');
    if (saved != null) {
      Api.token = saved;
      try {
        final data = await Api.get('/auth/me');
        user = AppUser.fromJson(Map<String, dynamic>.from(data['user']));
      } catch (_) {
        Api.token = null;
        await prefs.remove('token');
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await Api.post('/auth/login', {
      'email': email,
      'password': password,
    });
    await _saveSession(data);
  }

  Future<void> register(
    String name,
    String email,
    String password,
    String phone,
  ) async {
    final data = await Api.post('/auth/register', {
      'name': name,
      'email': email,
      'password': password,
      'phone': phone,
    });
    await _saveSession(data);
  }

  Future<void> _saveSession(dynamic data) async {
    Api.token = data['token'].toString();
    user = AppUser.fromJson(Map<String, dynamic>.from(data['user']));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', Api.token!);
    notifyListeners();
  }

  /// Re-reads the user from the server (e.g. to show updated points).
  Future<void> refreshUser() async {
    try {
      final data = await Api.get('/auth/me');
      user = AppUser.fromJson(Map<String, dynamic>.from(data['user']));
      notifyListeners();
    } catch (_) {}
  }

  Future<void> logout() async {
    Api.token = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    notifyListeners();
  }
}
