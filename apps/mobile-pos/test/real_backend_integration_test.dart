import 'package:flutter_test/flutter_test.dart';
import 'package:unisaas_mobile_pos/core/network/api_client.dart';

void main() {
  group('UniSaaS Mobile POS - Integración Real con NestJS Backend', () {
    late ApiClient apiClient;

    setUp(() {
      apiClient = ApiClient(baseUrl: 'http://localhost:3000/api/v1');
    });

    tearDown(() {
      apiClient.dispose();
    });

    test('Paso 1: Autenticación canónica contra NestJS (/api/v1/auth/login)',
        () async {
      final loginResult = await apiClient.login(
        'cajero@tenant-1111.com',
        'password123',
      );

      expect(loginResult.isValid, isTrue);
      expect(loginResult.token.isNotEmpty, isTrue);
      expect(
        loginResult.tenantId,
        equals('11111111-1111-1111-1111-111111111111'),
      );
      expect(loginResult.role, equals('CASHIER'));
      expect(loginResult.fullName, equals('Carlos Cajero'));
      expect(apiClient.isAuthenticated, isTrue);
    });

    test('Paso 2: Descarga de catálogo real con Bearer Token (/api/v1/inventory/products)',
        () async {
      // 1. Iniciar sesión
      await apiClient.login('cajero@tenant-1111.com', 'password123');

      // 2. Descargar catálogo
      final products = await apiClient.fetchProducts();

      expect(products, isNotEmpty);
      final product = products.firstWhere(
        (p) => p['id'] == 'f1111111-1111-1111-1111-111111111111',
      );
      expect(product['name'], equals('Gaseosa Cola 500ml'));
      expect(product['sku'], equals('COL-500-1111'));
    });

    test(
        'Paso 3 y 4: Checkout POS real con Idempotency-Key y verificación de replay (/api/v1/pos/checkout)',
        () async {
      // 1. Iniciar sesión
      final login =
          await apiClient.login('cajero@tenant-1111.com', 'password123');

      // 2. Preparar payload de checkout
      final idempotencyKey =
          'mob-real-test-${DateTime.now().millisecondsSinceEpoch}';
      final checkoutPayload = {
        'branchId': login.branchId.isNotEmpty
            ? login.branchId
            : 'a1111111-1111-1111-1111-111111111111',
        'items': [
          {
            'productId': 'f1111111-1111-1111-1111-111111111111',
            'variantId': 'f2222222-1111-1111-1111-111111111111',
            'warehouseId': 'b1111111-1111-1111-1111-111111111111',
            'quantity': 1,
            'unitPrice': 3000,
            'taxRate': 0.19,
          }
        ],
        'payment': {
          'method': 'EFECTIVO',
          'cashTendered': 5000,
        },
        'notes': 'Venta de auditoría de integración real Flutter-NestJS',
      };

      // 3. Ejecutar primera solicitud de checkout
      final res1 = await apiClient.checkout(checkoutPayload, idempotencyKey);

      expect(res1['success'], isTrue);
      expect(res1['invoiceId'], isNotNull);
      expect(res1['isReplay'] == true, isFalse);
      final invoiceId = res1['invoiceId'];

      // 4. Reejecutar la solicitud con la MISMA llave de idempotencia
      final res2 = await apiClient.checkout(checkoutPayload, idempotencyKey);

      expect(res2['success'], isTrue);
      expect(res2['invoiceId'], equals(invoiceId));
      expect(res2['isReplay'], isTrue);
    });

    test('Paso 5: Rechazo de credenciales inválidas (HTTP 401)', () async {
      expect(
        () => apiClient.login('cajero@tenant-1111.com', 'clave-erronea-xyz'),
        throwsA(isA<ApiException>().having(
          (e) => e.statusCode,
          'statusCode',
          equals(401),
        )),
      );
    });
  });
}
