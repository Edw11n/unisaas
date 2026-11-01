import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unisaas_mobile_pos/core/database/database.dart';
import 'package:unisaas_mobile_pos/core/network/api_client.dart';
import 'package:unisaas_mobile_pos/core/session/session.dart';
import 'package:unisaas_mobile_pos/core/sync/sync_queue_worker.dart';
import 'package:unisaas_mobile_pos/features/pos/providers/pos_providers.dart';
import 'package:unisaas_mobile_pos/main.dart';
import 'package:unisaas_mobile_pos/features/dashboard/presentation/dashboard_screen.dart';
import 'package:unisaas_mobile_pos/features/pos/presentation/pos_screen.dart';
import 'package:unisaas_mobile_pos/features/auth/presentation/login_screen.dart';

const testSession = AuthSession(
  token: 'test.jwt.token',
  tenantId: 'tenant-demo-empresa-01',
  branchId: 'branch-principal-01',
  userId: 'user-cajero-01',
  role: 'CASHIER',
  fullName: 'Pedro Cajero',
);

/// Overrides comunes: sesion autenticada, catalogo local controlado y worker
/// de sync sin temporizador (para que el test no deje timers pendientes).
List<Override> testOverrides({List<LocalProduct>? products}) => [
      initialSessionProvider.overrideWithValue(testSession),
      localProductsProvider.overrideWith(
        (ref) => Stream.value(products ?? const <LocalProduct>[]),
      ),
      syncWorkerProvider.overrideWith(
        (ref) => SyncQueueWorker(
          database: ref.watch(databaseProvider),
          apiClient: ApiClient(),
        ),
      ),
    ];

LocalProduct testProduct({
  String id = 'prod-test-01',
  String name = 'Cafe Americano',
  double price = 12000,
}) {
  return LocalProduct(
    id: id,
    serverId: id,
    sku: 'SKU-TEST-01',
    name: name,
    salePrice: price,
    taxRate: 0.19,
    stockOnHand: 25,
    unitOfMeasure: 'UND',
    category: 'Bebidas',
  );
}

// Mock HttpOverrides que devuelve una imagen PNG 1x1 transparente
class _TestHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return _MockHttpClient();
  }
}

class _MockHttpClient implements HttpClient {
  @override
  Future<HttpClientRequest> getUrl(Uri url) async => _MockHttpClientRequest();

  @override
  void close({bool force = false}) {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _MockHttpClientRequest implements HttpClientRequest {
  @override
  Future<HttpClientResponse> close() async => _MockHttpClientResponse();

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _MockHttpClientResponse implements HttpClientResponse {
  // Bytes de un PNG 1x1 transparente válido
  static final List<int> _transparentPng = [
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A,
    0x00,
    0x00,
    0x00,
    0x0D,
    0x49,
    0x48,
    0x44,
    0x52,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01,
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1F,
    0x15,
    0xC4,
    0x89,
    0x00,
    0x00,
    0x00,
    0x0A,
    0x49,
    0x44,
    0x41,
    0x54,
    0x78,
    0x9C,
    0x63,
    0x00,
    0x01,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01,
    0x0D,
    0x0A,
    0x2D,
    0xB4,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4E,
    0x44,
    0xAE,
    0x42,
    0x60,
    0x82,
  ];

  @override
  int get statusCode => HttpStatus.ok;

  @override
  int get contentLength => _transparentPng.length;

  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;

  @override
  StreamSubscription<List<int>> listen(void Function(List<int> event)? onData,
      {Function? onError, void Function()? onDone, bool? cancelOnError}) {
    return Stream<List<int>>.fromIterable([_transparentPng]).listen(
      onData,
      onError: onError,
      onDone: onDone,
      cancelOnError: cancelOnError,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() {
    HttpOverrides.global = _TestHttpOverrides();
  });

  tearDownAll(() {
    HttpOverrides.global = null;
  });

  group('Auditoria de Navegacion y Flujos Movil UNISAAS', () {
    testWidgets('1. Dashboard renderiza KPIs y navega al POS mostrador',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: testOverrides(),
          child: const UnisaasMobileApp(),
        ),
      );
      await tester.pumpAndSettle();

      // Verificar Dashboard en Espanol
      expect(find.byType(MobileDashboardScreen), findsOneWidget);
      expect(find.text('UNISAAS'), findsOneWidget);
      expect(find.text('Ventas de Hoy'), findsOneWidget);
      expect(find.text('Cobrado en Caja'), findsOneWidget);
      expect(find.text('Cartera (Fiado)'), findsOneWidget);
      expect(find.text('Bajo Minimo'), findsOneWidget);
      expect(find.text('Ventas del Periodo'), findsOneWidget);

      // Probar switcher de periodo Hoy / Semana / Mes
      await tester.tap(find.text('Mes'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Hoy'));
      await tester.pumpAndSettle();

      // Navegar a Vender POS desde el BottomNavBar
      final venderPosBtn = find.text('Vender POS');
      expect(venderPosBtn, findsOneWidget);
      await tester.tap(venderPosBtn);
      await tester.pumpAndSettle();

      // Verificar que se navego exitosamente a MobilePosScreen
      expect(find.byType(MobilePosScreen), findsOneWidget);
      expect(find.text('Pedro Cajero'), findsOneWidget);
    });

    testWidgets(
        '2. Mobile POS interactua con catalogo, carrito y modal de cobro',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: testOverrides(products: [testProduct()]),
          child: const MaterialApp(
            home: MobilePosScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verificar elementos del POS en Espanol
      expect(find.byType(MobilePosScreen), findsOneWidget);
      expect(find.text('Pedro Cajero'), findsOneWidget);
      expect(find.text('Todas'), findsOneWidget);
      expect(find.text('Cafe Americano'), findsOneWidget);

      // Probar agregar un item al carrito
      final addButtons = find.widgetWithText(ElevatedButton, 'Agregar');
      expect(addButtons, findsWidgets);
      await tester.tap(addButtons.first);
      await tester.pumpAndSettle();

      // Abrir Modal de Resumen / Cobro
      final checkoutBarBtn = find.text('Mi Pedido / Cobro');
      expect(checkoutBarBtn, findsOneWidget);
      await tester.tap(checkoutBarBtn);
      await tester.pumpAndSettle();

      // Verificar apertura del BottomSheet
      expect(find.text('Resumen del Pedido'), findsOneWidget);
      expect(find.text('Total a Pagar'), findsOneWidget);

      // Cambiar tipo de pedido (En Mesa, Para Llevar, Domicilio)
      if (find.text('Para Llevar').evaluate().isNotEmpty) {
        await tester.tap(find.text('Para Llevar'));
        await tester.pumpAndSettle();
      }

      // Completar venta y cobrar
      final checkoutModalBtn =
          find.widgetWithText(ElevatedButton, 'Completar Venta / Cobrar');
      expect(checkoutModalBtn, findsOneWidget);
      await tester.tap(checkoutModalBtn);
      await tester.pumpAndSettle();

      // Verificar mensaje de exito
      expect(find.text('Venta completada con exito en mostrador.'),
          findsOneWidget);
    });

    testWidgets(
        '3. Mobile Login renderiza formulario de acceso y valida campos obligatorios',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: MobileLoginScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verificar elementos del login
      expect(find.byType(MobileLoginScreen), findsOneWidget);
      expect(find.text('UNISAAS Movil'), findsOneWidget);
      expect(find.text('Iniciar Sesion'), findsOneWidget);

      // Intentar enviar formulario vacio
      await tester.tap(find.widgetWithText(ElevatedButton, 'Iniciar Sesion'));
      await tester.pumpAndSettle();

      // Debe mostrar mensaje de validacion
      expect(find.text('Ingrese su correo electronico'), findsOneWidget);
    });
  });
}
