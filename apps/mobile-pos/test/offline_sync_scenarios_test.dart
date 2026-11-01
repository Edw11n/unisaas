import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:path/path.dart' as p;
import 'package:unisaas_mobile_pos/core/database/database.dart';
import 'package:unisaas_mobile_pos/core/network/api_client.dart';
import 'package:unisaas_mobile_pos/core/sync/sync_queue_worker.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Certificación de Integración Offline-First y Outbox - Mobile POS', () {
    late AppDatabase db;

    setUp(() {
      db = AppDatabase(NativeDatabase.memory());
    });

    tearDown(() async {
      await db.close();
    });

    // =========================================================================
    // ESCENARIO A: Idempotencia en reintentos
    // =========================================================================
    test(
        'Escenario A: La app reintenta una venta offline usando exactamente la misma Idempotency-Key tras pérdida de red',
        () async {
      const idempotencyKey = 'idemp-mobile-sale-uuid-aaaa-1111';
      final requestsReceived = <http.Request>[];
      var attempts = 0;

      final mockClient = MockClient((request) async {
        requestsReceived.add(request);
        attempts++;
        if (attempts == 1) {
          // Intento 1: Pérdida abrupta de red (SocketException)
          throw const SocketException(
              'Network is unreachable / SocketException');
        }
        // Intento 2: Red recuperada, backend responde 201 Created confirmando la venta
        return http.Response(
          jsonEncode({
            'success': true,
            'invoiceId': 'inv-real-001',
            'consecutive': 'POS-001-00042',
            'total': 12000,
            'isReplay': false,
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        httpClient: mockClient,
      );
      apiClient.setAuth('jwt-token-cashier-01', 'tenant-demo-uuid');

      final worker = SyncQueueWorker(
        database: db,
        apiClient: apiClient,
        baseBackoffMs: 10,
        maxBackoffMs: 50,
      );

      // 1. Encolar venta en SQLite Outbox
      await db.insertSyncQueueItem(
        SyncQueueItemsCompanion(
          id: const Value('sync-item-a-01'),
          idempotencyKey: const Value(idempotencyKey),
          endpoint: const Value('/pos/checkout'),
          method: const Value('POST'),
          payloadJson: Value(jsonEncode({
            'branchId': '11111111-1111-1111-1111-111111111111',
            'items': [
              {
                'productId': 'prod-01',
                'quantity': 1,
                'unitPrice': 12000,
              }
            ],
            'payment': {'method': 'EFECTIVO', 'cashTendered': 12000},
          })),
          status: const Value('PENDING'),
          retryCount: const Value(0),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );

      // 2. Primer intento con fallo de red
      final syncedFirst = await worker.syncPendingItems();
      expect(syncedFirst, 0,
          reason: 'No debe marcar sincronizado si la red falló');

      var itemAfterFail = await db.getSyncItemById('sync-item-a-01');
      expect(itemAfterFail, isNotNull);
      expect(itemAfterFail!.status, 'PENDING',
          reason: 'Debe continuar en PENDING para reintento');
      expect(itemAfterFail.retryCount, 1,
          reason: 'Debe registrar 1 reintento fallido');
      expect(itemAfterFail.lastError, contains('SocketException'));

      // 3. Esperar que expire el backoff mínimo para el segundo intento
      await Future.delayed(const Duration(milliseconds: 30));

      // 4. Segundo intento con red restaurada
      final syncedSecond = await worker.syncPendingItems();
      expect(syncedSecond, 1,
          reason: 'Debe sincronizar exitosamente al restaurar red');

      var itemAfterSuccess = await db.getSyncItemById('sync-item-a-01');
      expect(itemAfterSuccess, isNotNull);
      expect(itemAfterSuccess!.status, 'SYNCED');

      // 5. Verificar garantías de idempotencia en ambas llamadas HTTP
      expect(requestsReceived.length, 2);
      for (final req in requestsReceived) {
        expect(req.url.path, '/api/v1/pos/checkout');
        expect(req.headers['Idempotency-Key'], idempotencyKey);
        expect(req.headers['X-Idempotency-Key'], idempotencyKey);
        expect(req.headers['Authorization'], 'Bearer jwt-token-cashier-01');
        expect(req.headers['X-Tenant-Id'], 'tenant-demo-uuid');
      }
    });

    // =========================================================================
    // ESCENARIO B: Retroceso exponencial ante errores 5xx del servidor
    // =========================================================================
    test(
        'Escenario B: El worker aplica retroceso exponencial ante 5xx, mantiene PENDING y se recupera con 200',
        () async {
      var serverStatus = 503;
      var callCount = 0;

      final mockClient = MockClient((request) async {
        callCount++;
        if (serverStatus >= 500) {
          return http.Response(
            jsonEncode(
                {'message': 'Base de datos temporalmente no disponible'}),
            serverStatus,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response(
          jsonEncode({
            'success': true,
            'invoiceId': 'inv-recovered-002',
            'consecutive': 'POS-001-00043',
            'total': 25000,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        httpClient: mockClient,
      );
      apiClient.setAuth('jwt-cashier-02', 'tenant-demo-uuid');

      final worker = SyncQueueWorker(
        database: db,
        apiClient: apiClient,
        baseBackoffMs: 50,
        maxBackoffMs: 500,
      );

      // Encolar item
      await db.insertSyncQueueItem(
        SyncQueueItemsCompanion(
          id: const Value('sync-item-b-02'),
          idempotencyKey: const Value('idemp-backoff-test-02'),
          endpoint: const Value('/pos/checkout'),
          method: const Value('POST'),
          payloadJson: Value(jsonEncode({'items': []})),
          status: const Value('PENDING'),
          retryCount: const Value(0),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );

      // 1. Intento 1: Servidor devuelve 503
      final synced1 = await worker.syncPendingItems();
      expect(synced1, 0);
      expect(callCount, 1);

      var item = await db.getSyncItemById('sync-item-b-02');
      expect(item!.status, 'PENDING',
          reason: 'No se debe descartar ante error 5xx');
      expect(item.retryCount, 1);
      expect(item.lastError, contains('503'));

      // Verificar que el cálculo de backoff es exponencial
      expect(
          worker.calculateBackoff(1).inMilliseconds, 100); // 50 * 2^1 = 100ms
      expect(
          worker.calculateBackoff(2).inMilliseconds, 200); // 50 * 2^2 = 200ms
      expect(
          worker.calculateBackoff(3).inMilliseconds, 400); // 50 * 2^3 = 400ms

      // 2. Intento inmediato (dentro de la ventana de backoff): debe omitirse
      final syncedImmediate = await worker.syncPendingItems();
      expect(syncedImmediate, 0);
      expect(callCount, 1,
          reason: 'No debe llamar al servidor mientras esté en backoff');

      // 3. Esperar que expire el backoff del primer reintento (100ms)
      await Future.delayed(const Duration(milliseconds: 120));

      // Recuperar el servidor
      serverStatus = 200;

      // 4. Siguiente intento: servidor recuperado responde 200 OK
      final syncedAfterRecovery = await worker.syncPendingItems();
      expect(syncedAfterRecovery, 1);
      expect(callCount, 2);

      var itemRecovered = await db.getSyncItemById('sync-item-b-02');
      expect(itemRecovered!.status, 'SYNCED');
    });

    // =========================================================================
    // ESCENARIO C: Conflicto de negocio (HTTP 409)
    // =========================================================================
    test(
        'Escenario C: Conflicto HTTP 409 marca CONFLICT, no reintenta en bucle y preserva payload y detalle',
        () async {
      var callCount = 0;
      final mockClient = MockClient((request) async {
        callCount++;
        return http.Response(
          jsonEncode({
            'statusCode': 409,
            'message':
                'Idempotency conflict: payload fingerprint mismatch for key idemp-conflict-03',
            'error': 'Conflict',
          }),
          409,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient(
        baseUrl: 'http://localhost:3000/api/v1',
        httpClient: mockClient,
      );
      apiClient.setAuth('jwt-cashier-03', 'tenant-demo-uuid');

      final worker = SyncQueueWorker(
        database: db,
        apiClient: apiClient,
      );

      const originalPayload =
          '{"items":[{"productId":"prod-conflict","qty":2}]}';
      const conflictKey = 'idemp-conflict-03';

      await db.insertSyncQueueItem(
        SyncQueueItemsCompanion(
          id: const Value('sync-item-c-03'),
          idempotencyKey: const Value(conflictKey),
          endpoint: const Value('/pos/checkout'),
          method: const Value('POST'),
          payloadJson: const Value(originalPayload),
          status: const Value('PENDING'),
          retryCount: const Value(0),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );

      // 1. Ejecutar worker contra respuesta 409
      final synced = await worker.syncPendingItems();
      expect(synced, 0);
      expect(callCount, 1);

      // 2. Verificar que se marcó como CONFLICT
      final item = await db.getSyncItemById('sync-item-c-03');
      expect(item, isNotNull);
      expect(item!.status, 'CONFLICT',
          reason: 'Debe marcarse explícitamente como CONFLICT');
      expect(item.lastError, contains('409'));
      expect(item.lastError, contains('fingerprint mismatch'));
      expect(item.payloadJson, originalPayload,
          reason: 'El payload debe preservarse intacto');
      expect(item.idempotencyKey, conflictKey);

      // 3. Ejecutar el worker nuevamente: no debe reintentar en bucle infinito
      final syncedSecondRun = await worker.syncPendingItems();
      expect(syncedSecondRun, 0);
      expect(callCount, 1,
          reason:
              'No debe volver a llamar al servidor para un ítem en CONFLICT');

      // 4. Verificar consultas y streams de conflictos
      final conflicts = await db.getConflictSyncItems();
      expect(conflicts.length, 1);
      expect(conflicts.first.id, 'sync-item-c-03');

      // 5. Soporte de reintento manual tras resolución de conflicto
      final retried = await db.retryConflictItem('sync-item-c-03');
      expect(retried, isTrue);

      final itemReset = await db.getSyncItemById('sync-item-c-03');
      expect(itemReset!.status, 'PENDING');
      expect(itemReset.retryCount, 0);
    });

    // =========================================================================
    // ESCENARIO D: Persistencia de la cola local entre reinicios de la aplicación
    // =========================================================================
    test(
        'Escenario D: Los ítems de la cola Outbox sobreviven a reinicios completos de la base de datos',
        () async {
      final tempDir = await Directory.systemTemp.createTemp('unisaas_db_test_');
      final dbFile = File(p.join(tempDir.path, 'persistent_outbox.sqlite'));

      try {
        // 1. Abrir base de datos inicial y guardar 3 operaciones con distintos estados
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await db1.insertSyncQueueItem(
          SyncQueueItemsCompanion(
            id: const Value('item-p-pending'),
            idempotencyKey: const Value('key-pending-1'),
            endpoint: const Value('/pos/checkout'),
            method: const Value('POST'),
            payloadJson: const Value('{"sale":"pending"}'),
            status: const Value('PENDING'),
            retryCount: const Value(2),
            createdAt: Value(DateTime.now()),
            updatedAt: Value(DateTime.now()),
          ),
        );
        await db1.insertSyncQueueItem(
          SyncQueueItemsCompanion(
            id: const Value('item-p-conflict'),
            idempotencyKey: const Value('key-conflict-2'),
            endpoint: const Value('/pos/checkout'),
            method: const Value('POST'),
            payloadJson: const Value('{"sale":"conflict"}'),
            status: const Value('CONFLICT'),
            lastError: const Value('HTTP 409: Duplicate lock'),
            retryCount: const Value(1),
            createdAt: Value(DateTime.now()),
            updatedAt: Value(DateTime.now()),
          ),
        );
        await db1.insertSyncQueueItem(
          SyncQueueItemsCompanion(
            id: const Value('item-p-synced'),
            idempotencyKey: const Value('key-synced-3'),
            endpoint: const Value('/pos/checkout'),
            method: const Value('POST'),
            payloadJson: const Value('{"sale":"synced"}'),
            status: const Value('SYNCED'),
            retryCount: const Value(1),
            createdAt: Value(DateTime.now()),
            updatedAt: Value(DateTime.now()),
          ),
        );

        // 2. Simular cierre completo de la app
        await db1.close();

        // 3. Simular reapertura de la app con una nueva instancia de AppDatabase
        final db2 = AppDatabase(NativeDatabase(dbFile));

        // 4. Verificar integridad de los datos restaurados
        final pending = await db2.getPendingSyncItems();
        expect(pending.length, 1);
        expect(pending.first.id, 'item-p-pending');
        expect(pending.first.idempotencyKey, 'key-pending-1');
        expect(pending.first.retryCount, 2);
        expect(pending.first.payloadJson, '{"sale":"pending"}');

        final conflicts = await db2.getConflictSyncItems();
        expect(conflicts.length, 1);
        expect(conflicts.first.id, 'item-p-conflict');
        expect(conflicts.first.lastError, 'HTTP 409: Duplicate lock');

        final syncedItem = await db2.getSyncItemById('item-p-synced');
        expect(syncedItem, isNotNull);
        expect(syncedItem!.status, 'SYNCED');

        await db2.close();
      } finally {
        if (await tempDir.exists()) {
          await tempDir.delete(recursive: true);
        }
      }
    });
  });
}
