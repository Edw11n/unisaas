import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../config/environment.dart';
import '../database/database.dart';
import '../network/api_client.dart';

/// Worker de la cola transaccional Outbox de UniSaaS Mobile POS.
///
/// Gestiona la sincronización asíncrona de operaciones offline hacia el backend NestJS:
/// - Idempotencia estricta mediante `Idempotency-Key` en cada intento.
/// - Retroceso exponencial (exponential backoff) ante fallos de red o errores 5xx.
/// - Tratamiento explícito de conflictos de negocio (HTTP 409): marca el ítem como CONFLICT,
///   no lo reintenta en bucle y preserva el payload y los detalles para resolución.
/// - Detención segura ante HTTP 401/403 para no consumir reintentos con sesión vencida.
class SyncQueueWorker {
  final AppDatabase database;
  final ApiClient apiClient;

  Timer? _timer;
  bool _isSyncing = false;
  String? _lastAuthError;

  // Mapa en memoria de próxima ejecución permitida por ID para respetar backoff
  final Map<String, DateTime> _nextRetrySchedule = {};

  final int baseBackoffMs;
  final int maxBackoffMs;
  final int maxRetries;

  SyncQueueWorker({
    required this.database,
    required this.apiClient,
    this.baseBackoffMs = 1000,
    this.maxBackoffMs = 30000,
    this.maxRetries = 5,
  });

  bool get isSyncing => _isSyncing;
  bool get requiresReauthentication => _lastAuthError != null;
  String? get lastAuthError => _lastAuthError;

  void clearAuthError() {
    _lastAuthError = null;
  }

  /// Inicia el temporizador de sincronización periódica.
  void startPeriodicSync({Duration? interval}) {
    _timer?.cancel();
    _timer = Timer.periodic(interval ?? Environment.syncInterval, (_) {
      syncPendingItems();
    });
  }

  void stopPeriodicSync() {
    _timer?.cancel();
    _timer = null;
  }

  /// Calcula el tiempo de espera exponencial según el número de reintentos.
  Duration calculateBackoff(int retryCount) {
    final exponent = math.min(retryCount, 10);
    final delayMs = math.min(
      maxBackoffMs,
      baseBackoffMs * (1 << exponent),
    );
    return Duration(milliseconds: delayMs);
  }

  /// Verifica si un ítem está listo para reintento respetando su backoff.
  bool isReadyForRetry(String itemId) {
    final nextRetry = _nextRetrySchedule[itemId];
    if (nextRetry == null) return true;
    return DateTime.now().isAfter(nextRetry) ||
        DateTime.now().isAtSameMomentAs(nextRetry);
  }

  /// Procesa todos los elementos `PENDING` de la cola Outbox.
  Future<int> syncPendingItems() async {
    if (_isSyncing) return 0;
    if (Environment.useMockBackend) return 0;

    if (!apiClient.isAuthenticated) {
      _lastAuthError =
          'Sesión no autenticada: la cola espera inicio de sesión.';
      return 0;
    }

    _isSyncing = true;
    var syncedCount = 0;

    try {
      final pendingList = await database.getPendingSyncItems();
      if (pendingList.isEmpty) return 0;

      for (final item in pendingList) {
        // Respetar tiempo de retroceso exponencial si fue programado
        if (!isReadyForRetry(item.id)) {
          debugPrint(
              'SyncQueueWorker: Ítem ${item.id} en backoff hasta ${_nextRetrySchedule[item.id]}');
          continue;
        }

        try {
          final response = await apiClient.executeSyncItem(
            endpoint: item.endpoint,
            method: item.method,
            payloadJson: item.payloadJson,
            idempotencyKey: item.idempotencyKey,
          );

          final statusCode = response.statusCode;

          // 1. Éxito (2xx): venta confirmada o respuesta idempotente previa rejugada
          if (statusCode >= 200 && statusCode < 300) {
            await database.markItemSynced(item.id);
            _nextRetrySchedule.remove(item.id);
            _lastAuthError = null;
            syncedCount++;
            debugPrint(
                'SyncQueueWorker: Ítem ${item.id} sincronizado exitosamente (HTTP $statusCode).');
          }
          // 2. Sesión expirada o no autorizada (401/403): pausar worker sin quemar reintentos
          else if (statusCode == 401 || statusCode == 403) {
            _lastAuthError =
                'Sesión rechazada por el servidor (HTTP $statusCode). '
                'Reautentíquese para reanudar la sincronización.';
            debugPrint('SyncQueueWorker: $_lastAuthError');
            break; // Detener procesamiento hasta reautenticar
          }
          // 3. Conflicto de negocio (HTTP 409): marcar como CONFLICT sin bucle infinito
          else if (statusCode == 409) {
            final conflictMsg = 'Conflicto HTTP 409: ${response.body}';
            await database.markItemConflict(item.id, conflictMsg);
            _nextRetrySchedule.remove(item.id);
            debugPrint(
                'SyncQueueWorker: Conflicto detectado en ítem ${item.id}: $conflictMsg');
          }
          // 4. Errores de servidor (5xx) u otros códigos: aplicar retroceso exponencial
          else {
            final errorMsg = 'HTTP $statusCode: ${response.body}';
            final nextRetry = item.retryCount + 1;
            await database.markItemFailed(item.id, errorMsg,
                maxRetries: maxRetries);

            // Programar siguiente intento con backoff exponencial
            final backoffDuration = calculateBackoff(nextRetry);
            _nextRetrySchedule[item.id] = DateTime.now().add(backoffDuration);

            debugPrint(
                'SyncQueueWorker: Error en ítem ${item.id} (intento $nextRetry). '
                'Reintento en ${backoffDuration.inMilliseconds}ms. Detalle: $errorMsg');
          }
        } on ApiException catch (e) {
          if (e.isUnauthorized) {
            _lastAuthError = e.message;
            break;
          } else if (e.isConflict) {
            await database.markItemConflict(item.id, e.message);
            _nextRetrySchedule.remove(item.id);
          } else {
            final nextRetry = item.retryCount + 1;
            await database.markItemFailed(item.id, e.message,
                maxRetries: maxRetries);
            final backoffDuration = calculateBackoff(nextRetry);
            _nextRetrySchedule[item.id] = DateTime.now().add(backoffDuration);
          }
        } catch (e) {
          // Excepciones de red (SocketException, ClientException, Timeout)
          final errorMsg = 'Error de transporte / red: $e';
          final nextRetry = item.retryCount + 1;
          await database.markItemFailed(item.id, errorMsg,
              maxRetries: maxRetries);

          final backoffDuration = calculateBackoff(nextRetry);
          _nextRetrySchedule[item.id] = DateTime.now().add(backoffDuration);

          debugPrint(
              'SyncQueueWorker: Excepción de red en ítem ${item.id}: $errorMsg. '
              'Backoff: ${backoffDuration.inMilliseconds}ms');
        }
      }
    } finally {
      _isSyncing = false;
    }

    return syncedCount;
  }
}
