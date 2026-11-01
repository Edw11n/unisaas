import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/environment.dart';

/// Excepción de comunicación con el backend NestJS de UniSaaS.
/// Conserva el código HTTP, el mensaje funcional y banderas de clasificación.
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? responseBody;

  const ApiException(this.message, [this.statusCode, this.responseBody]);

  bool get isUnauthorized => statusCode == 401 || statusCode == 403;
  bool get isConflict => statusCode == 409;
  bool get isServerError =>
      statusCode != null && statusCode! >= 500 && statusCode! < 600;
  bool get isNetworkOrTimeout =>
      statusCode == null ||
      statusCode == 408 ||
      statusCode == 503 ||
      statusCode == 504;

  @override
  String toString() =>
      statusCode == null ? message : '$message (HTTP $statusCode)';
}

/// Resultado normalizado del inicio de sesión.
class LoginResult {
  final String token;
  final String tenantId;
  final String branchId;
  final String userId;
  final String role;
  final String fullName;
  final Map<String, dynamic> raw;

  const LoginResult({
    required this.token,
    required this.tenantId,
    required this.branchId,
    required this.userId,
    required this.role,
    required this.fullName,
    required this.raw,
  });

  bool get isValid => token.isNotEmpty && tenantId.isNotEmpty;
}

class ApiClient {
  final String baseUrl;
  final http.Client _httpClient;
  final Duration _timeout;

  String? _token;
  String? _tenantId;

  ApiClient({
    String? baseUrl,
    http.Client? httpClient,
    Duration? timeout,
  })  : baseUrl = _normalizeBaseUrl(baseUrl ?? Environment.apiBaseUrl),
        _httpClient = httpClient ?? http.Client(),
        _timeout = timeout ?? const Duration(seconds: 30);

  static String _normalizeBaseUrl(String value) {
    final trimmed = value.trim();
    if (trimmed.endsWith('/')) {
      return trimmed.substring(0, trimmed.length - 1);
    }
    return trimmed;
  }

  void setAuth(String token, String tenantId) {
    _token = token;
    _tenantId = tenantId;
  }

  void clearAuth() {
    _token = null;
    _tenantId = null;
  }

  bool get isAuthenticated => _token != null && _token!.isNotEmpty;
  String? get token => _token;
  String? get tenantId => _tenantId;

  Map<String, String> _headers([String? idempotencyKey]) {
    final map = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_token != null && _token!.isNotEmpty) {
      map['Authorization'] = 'Bearer $_token';
    }
    if (_tenantId != null && _tenantId!.isNotEmpty) {
      map['X-Tenant-Id'] = _tenantId!;
    }
    if (idempotencyKey != null && idempotencyKey.isNotEmpty) {
      map['Idempotency-Key'] = idempotencyKey;
      map['X-Idempotency-Key'] = idempotencyKey;
    }
    return map;
  }

  Future<http.Response> _send(Future<http.Response> Function() request) {
    return request().timeout(
      _timeout,
      onTimeout: () => throw const ApiException(
        'Tiempo de espera agotado al contactar el servidor. Verifique la conexión.',
        408,
      ),
    );
  }

  String _buildUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    final cleanPath = path.startsWith('/') ? path : '/$path';

    // Si la ruta empieza con /api/
    if (cleanPath.startsWith('/api/')) {
      if (baseUrl.endsWith('/api/v1')) {
        // Si el path ya tiene /api/v1, no duplicar
        if (cleanPath.startsWith('/api/v1/')) {
          return '$baseUrl${cleanPath.substring(7)}';
        }
        // Si tiene /api/... reemplazar por baseUrl (/api/v1)
        return '$baseUrl${cleanPath.substring(4)}';
      }
      return '$baseUrl$cleanPath';
    }

    if (baseUrl.endsWith('/api/v1') || baseUrl.endsWith('/api')) {
      return '$baseUrl$cleanPath';
    }
    return '$baseUrl/api$cleanPath';
  }

  // 1. Autenticación (/api/auth/login o /api/v1/auth/login)
  Future<LoginResult> login(String email, String password) async {
    final url = _buildUrl('/api/auth/login');
    final response = await _send(() => _httpClient.post(
          Uri.parse(url),
          headers: const {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: jsonEncode({'email': email.trim(), 'password': password}),
        ));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _extractMessage(response, 'Fallo de autenticación'),
        response.statusCode,
        response.body,
      );
    }

    final data = _decodeObject(response);
    final user = _asMap(data['user']);
    final tenant = _asMap(data['tenant']);

    final bodyToken =
        data['accessToken'] ?? data['token'] ?? data['access_token'];
    final token = (bodyToken is String && bodyToken.isNotEmpty)
        ? bodyToken
        : _tokenFromCookies(response.headers);

    final tenantId =
        (user?['tenantId'] ?? tenant?['id'] ?? data['tenantId'] ?? '')
            .toString();

    if (token == null || token.isEmpty) {
      throw const ApiException(
        'El servidor no devolvió un token de acceso válido.',
        502,
      );
    }
    if (tenantId.isEmpty) {
      throw const ApiException(
        'La respuesta de autenticación no incluye el tenant del usuario.',
        502,
      );
    }

    setAuth(token, tenantId);

    return LoginResult(
      token: token,
      tenantId: tenantId,
      branchId: (user?['branchId'] ?? tenant?['branchId'] ?? '').toString(),
      userId: (user?['id'] ?? '').toString(),
      role: (user?['role'] ?? '').toString(),
      fullName: (user?['fullName'] ?? user?['name'] ?? '').toString(),
      raw: data,
    );
  }

  // 2. Catálogo de productos (/inventory/products)
  Future<List<Map<String, dynamic>>> fetchProducts({String? vertical}) async {
    if (!isAuthenticated) {
      throw const ApiException(
        'Sesión no autenticada: inicie sesión antes de sincronizar el catálogo.',
        401,
      );
    }

    final baseUri = Uri.parse(_buildUrl('/api/inventory/products'));
    final uri = vertical != null && vertical.isNotEmpty
        ? baseUri.replace(queryParameters: {'vertical': vertical})
        : baseUri;

    final response =
        await _send(() => _httpClient.get(uri, headers: _headers()));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _extractMessage(response, 'Error al descargar catálogo de productos'),
        response.statusCode,
        response.body,
      );
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    final rawList = decoded is List
        ? decoded
        : (decoded is Map<String, dynamic>
            ? (decoded['data'] ?? decoded['products'] ?? decoded['items'])
            : null);

    if (rawList is! List) {
      throw const ApiException(
        'Formato de catálogo inesperado: el servidor no devolvió una lista de productos.',
        502,
      );
    }

    return rawList
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  // 3. Checkout directo (/pos/checkout)
  Future<Map<String, dynamic>> checkout(
    Map<String, dynamic> payload,
    String idempotencyKey,
  ) async {
    final response = await executeSyncItem(
      endpoint: '/pos/checkout',
      method: 'POST',
      payloadJson: jsonEncode(payload),
      idempotencyKey: idempotencyKey,
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _extractMessage(response, 'Error al procesar checkout'),
        response.statusCode,
        response.body,
      );
    }

    return _decodeObject(response);
  }

  // 4. Ejecución genérica para items de la cola Outbox
  Future<http.Response> executeSyncItem({
    required String endpoint,
    required String method,
    required String payloadJson,
    required String idempotencyKey,
  }) async {
    final uri = Uri.parse(_buildUrl(endpoint));
    final headers = _headers(idempotencyKey);
    final upperMethod = method.toUpperCase();

    return _send(() {
      switch (upperMethod) {
        case 'POST':
          return _httpClient.post(uri, headers: headers, body: payloadJson);
        case 'PUT':
          return _httpClient.put(uri, headers: headers, body: payloadJson);
        case 'PATCH':
          return _httpClient.patch(uri, headers: headers, body: payloadJson);
        case 'DELETE':
          return _httpClient.delete(uri, headers: headers, body: payloadJson);
        default:
          return _httpClient.get(uri, headers: headers);
      }
    });
  }

  void dispose() => _httpClient.close();

  // --- Utilidades internas ---

  Map<String, dynamic> _decodeObject(http.Response response) {
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is Map<String, dynamic>) return decoded;
      return {'data': decoded};
    } catch (_) {
      throw ApiException(
        'Respuesta del servidor con formato inválido (no es JSON).',
        502,
        response.body,
      );
    }
  }

  Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  String _extractMessage(http.Response response, String fallback) {
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is Map) {
        final msg = decoded['message'] ?? decoded['error'] ?? decoded['detail'];
        if (msg is String && msg.trim().isNotEmpty) return msg.trim();
        if (msg is List && msg.isNotEmpty) return msg.join(', ');
      }
    } catch (_) {}
    return '$fallback (HTTP ${response.statusCode})';
  }

  String? _tokenFromCookies(Map<String, String> headers) {
    final raw = headers['set-cookie'] ?? headers['Set-Cookie'];
    if (raw == null || raw.isEmpty) return null;

    for (final cookieName in const [
      'unisaas_access_token',
      'unisaas_session'
    ]) {
      final pattern = RegExp('(?:^|[;,\\s])$cookieName=([^;,\\s]+)');
      final match = pattern.firstMatch(raw);
      final value = match?.group(1)?.trim();
      if (value != null && value.isNotEmpty) return value;
    }
    return null;
  }
}
