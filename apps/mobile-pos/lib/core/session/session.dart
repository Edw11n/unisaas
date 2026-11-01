import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Sesión autenticada contra el backend NestJS de UniSaaS.
///
/// El backend entrega el JWT en `accessToken` o cabeceras Set-Cookie.
/// El cliente móvil lo reenvía como `Authorization: Bearer <token>`
/// y `X-Tenant-Id: <tenantId>`.
class AuthSession {
  final String token;
  final String tenantId;
  final String branchId;
  final String userId;
  final String role;
  final String fullName;

  const AuthSession({
    required this.token,
    required this.tenantId,
    this.branchId = '',
    this.userId = '',
    this.role = '',
    this.fullName = '',
  });

  bool get isAuthenticated => token.isNotEmpty && tenantId.isNotEmpty;

  Map<String, dynamic> toJson() => {
        'token': token,
        'tenantId': tenantId,
        'branchId': branchId,
        'userId': userId,
        'role': role,
        'fullName': fullName,
      };

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    String read(String key) => (json[key] ?? '').toString();
    return AuthSession(
      token: read('token'),
      tenantId: read('tenantId'),
      branchId: read('branchId'),
      userId: read('userId'),
      role: read('role'),
      fullName: read('fullName'),
    );
  }

  /// Reconstruye los datos de la sesión a partir del payload del JWT cuando
  /// el almacenamiento local solo conservó el token.
  factory AuthSession.fromToken(String token) {
    final claims = _decodeClaims(token);
    String claim(List<String> keys) {
      for (final key in keys) {
        final value = claims[key];
        if (value != null && value.toString().isNotEmpty) {
          return value.toString();
        }
      }
      return '';
    }

    return AuthSession(
      token: token,
      tenantId: claim(['tenantId', 'tenant_id']),
      branchId: claim(['branchId', 'branch_id']),
      userId: claim(['sub', 'userId', 'id']),
      role: claim(['role']),
      fullName: claim(['fullName', 'name', 'email']),
    );
  }

  static Map<String, dynamic> _decodeClaims(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return const {};
      final payload = parts[1];
      final normalized = base64Url.normalize(payload);
      final decoded = utf8.decode(base64Url.decode(normalized));
      final json = jsonDecode(decoded);
      return json is Map<String, dynamic> ? json : const {};
    } catch (_) {
      return const {};
    }
  }
}

/// Sesión inicial inyectada en `main()` tras restaurar el almacenamiento seguro.
final initialSessionProvider = Provider<AuthSession?>((ref) => null);

class AuthSessionNotifier extends StateNotifier<AuthSession?> {
  AuthSessionNotifier([super.initial]);

  void start(AuthSession session) => state = session;

  void end() => state = null;
}

final authSessionProvider =
    StateNotifierProvider<AuthSessionNotifier, AuthSession?>((ref) {
  return AuthSessionNotifier(ref.watch(initialSessionProvider));
});

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

/// Persistencia segura de la sesión en el keystore del dispositivo.
class SessionStore {
  SessionStore._();

  static const _sessionKey = 'unisaas_mobile_session';
  static const _tokenKey = 'unisaas_mobile_jwt';
  static const _tenantKey = 'unisaas_mobile_tenant_id';
  static const _storage = FlutterSecureStorage();

  static Future<AuthSession?> restore() async {
    try {
      final raw = await _storage.read(key: _sessionKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          final session = AuthSession.fromJson(decoded);
          if (session.isAuthenticated) return session;
        }
      }

      final token = await _storage.read(key: _tokenKey);
      if (token != null && token.isNotEmpty) {
        final session = AuthSession.fromToken(token);
        if (session.isAuthenticated) return session;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<void> save(AuthSession session) async {
    try {
      await _storage.write(
          key: _sessionKey, value: jsonEncode(session.toJson()));
      await _storage.write(key: _tokenKey, value: session.token);
      await _storage.write(key: _tenantKey, value: session.tenantId);
    } catch (_) {}
  }

  static Future<void> clear() async {
    try {
      await _storage.delete(key: _sessionKey);
      await _storage.delete(key: _tokenKey);
      await _storage.delete(key: _tenantKey);
    } catch (_) {}
  }
}
