import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:unisaas_mobile_pos/core/database/database.dart';
import 'package:unisaas_mobile_pos/core/network/api_client.dart';
import 'package:unisaas_mobile_pos/core/sync/sync_queue_worker.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ApiClient contra el contrato del BFF', () {
    test('login toma el JWT de la cookie unisaas_access_token', () async {
      final client = ApiClient(
        baseUrl: 'http://bff.test:3100',
        httpClient: MockClient((request) async {
          expect(request.url.toString(), 'http://bff.test:3100/api/auth/login');
          expect(request.method, 'POST');
          return http.Response(
            jsonEncode({
              'success': true,
              'user': {
                'id': 'user-01',
                'tenantId': 'tenant-01',
                'branchId': 'branch-01',
                'role': 'OWNER',
                'fullName': 'Ana Administradora',
              },
            }),
            200,
            headers: {
              'content-type': 'application/json',
              // Formato real que emite el BFF (Next.js) con dos cookies.
              'set-cookie':
                  'unisaas_session=AAA.BBB.CCC; Path=/; HttpOnly, unisaas_access_token=XXX.YYY.ZZZ; Path=/; HttpOnly; SameSite=Lax',
            },
          );
        }),
      );

      final result = await client.login('owner@test.com', 'secret');

      expect(result.token, 'XXX.YYY.ZZZ');
      expect(result.tenantId, 'tenant-01');
      expect(result.branchId, 'branch-01');
      expect(result.userId, 'user-01');
      expect(result.role, 'OWNER');
      expect(client.isAuthenticated, isTrue);
    });

    test('login propaga el mensaje de error del BFF', () async {
      final client = ApiClient(
        baseUrl: 'http://bff.test:3100',
        httpClient: MockClient((_) async => http.Response(
              jsonEncode(
                  {'message': 'Credenciales invalidas o acceso denegado.'}),
              401,
              headers: {'content-type': 'application/json'},
            )),
      );

      expect(
        () => client.login('owner@test.com', 'bad'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 401)
              .having((e) => e.isUnauthorized, 'isUnauthorized', true),
        ),
      );
    });

    test('fetchProducts envia Bearer y X-Tenant-Id', () async {
      late http.Request captured;
      final client = ApiClient(
        baseUrl: 'http://bff.test:3100/',
        httpClient: MockClient((request) async {
          captured = request;
          return http.Response(
            jsonEncode([
              {
                'id': 'p1',
                'name': 'Cafe',
                'salePrice': 12000,
                'currentStock': 5
              },
            ]),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      client.setAuth('token-abc', 'tenant-01');

      final products = await client.fetchProducts();

      expect(captured.url.toString(),
          'http://bff.test:3100/api/inventory/products');
      expect(captured.headers['Authorization'], 'Bearer token-abc');
      expect(captured.headers['X-Tenant-Id'], 'tenant-01');
      expect(products.single['id'], 'p1');
    });

    test('fetchProducts sin sesion falla con 401 local', () async {
      final client = ApiClient(
        baseUrl: 'http://bff.test:3100',
        httpClient: MockClient((_) async => http.Response('[]', 200)),
      );

      expect(
        () => client.fetchProducts(),
        throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)),
      );
    });
  });

  group('SyncQueueWorker (outbox SQLite -> BFF)', () {
    late AppDatabase database;

    setUp(() {
      database = AppDatabase(NativeDatabase.memory());
    });

    tearDown(() async {
      await database.close();
    });

    Future<void> enqueueSale(AppDatabase db) {
      return db.insertSyncQueueItem(
        SyncQueueItemsCompanion.insert(
          id: 'sync-1',
          idempotencyKey: 'idem-1',
          endpoint: '/api/checkout',
          payloadJson: jsonEncode({'grandTotal': 82000}),
          status: const Value('PENDING'),
        ),
      );
    }

    test('marca SYNCED cuando el BFF responde 2xx', () async {
      await enqueueSale(database);

      final client = ApiClient(
        baseUrl: 'http://bff.test:3100',
        httpClient: MockClient((request) async {
          expect(request.url.toString(), 'http://bff.test:3100/api/checkout');
          expect(request.headers['X-Idempotency-Key'], 'idem-1');
          expect(request.headers['Authorization'], 'Bearer token-abc');
          return http.Response(jsonEncode({'success': true}), 201);
        }),
      );
      client.setAuth('token-abc', 'tenant-01');

      final worker = SyncQueueWorker(database: database, apiClient: client);
      final synced = await worker.syncPendingItems();

      expect(synced, 1);
      expect(await database.getPendingSyncItems(), isEmpty);
    });

    test('mantiene el item PENDING y guarda lastError si falla la red',
        () async {
      await enqueueSale(database);

      final client = ApiClient(
        baseUrl: 'http://bff.test:3100',
        httpClient:
            MockClient((_) async => throw const SocketException('sin red')),
      );
      client.setAuth('token-abc', 'tenant-01');

      final worker = SyncQueueWorker(database: database, apiClient: client);
      final synced = await worker.syncPendingItems();

      expect(synced, 0);
      final pending = await database.getPendingSyncItems();
      expect(pending, hasLength(1));
      expect(pending.single.retryCount, 1);
      expect(pending.single.lastError, isNotNull);
    });

    test('detiene la cola cuando el BFF responde 401', () async {
      await enqueueSale(database);

      final client = ApiClient(
        baseUrl: 'http://bff.test:3100',
        httpClient: MockClient(
            (_) async => http.Response('{"message":"Sesion expirada"}', 401)),
      );
      client.setAuth('token-vencido', 'tenant-01');

      final worker = SyncQueueWorker(database: database, apiClient: client);
      await worker.syncPendingItems();

      expect(worker.requiresReauthentication, isTrue);
      final pending = await database.getPendingSyncItems();
      expect(pending, hasLength(1));
      // El item no se marca como fallido ni consume reintentos: se reintenta
      // cuando el usuario vuelva a iniciar sesion.
      expect(pending.single.retryCount, 0);
      expect(pending.single.lastError, isNull);
    });
  });
}
