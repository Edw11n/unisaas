import 'dart:io';

/// Configuración de entorno de UniSaaS Mobile POS.
///
/// Soporta configuración en tiempo de compilación con `--dart-define`
/// y defaults inteligentes según la plataforma (Android emulator vs Desktop/Web).
class Environment {
  Environment._();

  static const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// URL base del API Gateway de NestJS (ej. http://localhost:3000/api/v1).
  static String get apiBaseUrl {
    if (_definedBaseUrl.isNotEmpty) return _definedBaseUrl;
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:3000/api/v1';
      }
    } catch (_) {}
    return 'http://localhost:3000/api/v1';
  }

  /// Bandera única de modo demostración. Por defecto SIEMPRE es `false`.
  static const bool useMockBackend = bool.fromEnvironment(
    'USE_MOCK_BACKEND',
    defaultValue: false,
  );

  /// Intervalo del worker de sincronización de la cola Outbox en segundos.
  static const int syncIntervalSeconds = int.fromEnvironment(
    'OFFLINE_SYNC_INTERVAL_SECONDS',
    defaultValue: 30,
  );

  /// Intervalo como Duration.
  static Duration get syncInterval =>
      const Duration(seconds: syncIntervalSeconds);

  /// Bodega por defecto usada al despachar inventario.
  static const String warehouseId = String.fromEnvironment('WAREHOUSE_ID');

  /// Turno de caja POS abierto.
  static const String posShiftId = String.fromEnvironment('POS_SHIFT_ID');

  /// Identificador de la caja/terminal móvil.
  static const String registerNumber = String.fromEnvironment(
    'POS_REGISTER_NUMBER',
    defaultValue: 'POS-MOB-01',
  );

  /// Sucursal por defecto si la sesión no contiene una específica.
  static const String defaultBranchId = String.fromEnvironment(
    'BRANCH_ID',
    defaultValue: '11111111-1111-1111-1111-111111111111',
  );

  /// Consumidor final predeterminado
  static const String finalCustomerId = 'cust-final';
  static const String finalCustomerName = 'Consumidor Final';
  static const String finalCustomerDocument = '222222222222';

  static bool get hasBackendConfigured => apiBaseUrl.isNotEmpty;
}
