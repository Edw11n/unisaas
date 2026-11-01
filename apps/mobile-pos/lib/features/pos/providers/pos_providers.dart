import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/config/environment.dart';
import '../../../core/database/database.dart';
import '../../../core/network/api_client.dart';
import '../../../core/session/session.dart';
import '../../../core/sync/sync_queue_worker.dart';
import '../models/cart_item.dart';
import '../models/sale_payload.dart';

final databaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(() => db.close());
  return db;
});

/// Catálogo local (SQLite/Drift) que alimenta el POS móvil.
final localProductsProvider = StreamProvider<List<LocalProduct>>((ref) {
  return ref.watch(databaseProvider).watchAllProducts();
});

/// Cliente HTTP autenticado para la API de NestJS.
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(baseUrl: Environment.apiBaseUrl);
  final session = ref.watch(authSessionProvider);
  if (session != null && session.isAuthenticated) {
    client.setAuth(session.token, session.tenantId);
  }
  ref.onDispose(client.dispose);
  return client;
});

final syncWorkerProvider = Provider<SyncQueueWorker>((ref) {
  final db = ref.watch(databaseProvider);
  final client = ref.watch(apiClientProvider);
  final worker = SyncQueueWorker(database: db, apiClient: client);
  if (!Environment.useMockBackend) {
    worker.startPeriodicSync(interval: Environment.syncInterval);
  }
  ref.onDispose(() => worker.stopPeriodicSync());
  return worker;
});

final pendingSyncCountProvider = StreamProvider<int>((ref) {
  final db = ref.watch(databaseProvider);
  return db.watchPendingCount();
});

final conflictSyncCountProvider = StreamProvider<int>((ref) {
  final db = ref.watch(databaseProvider);
  return db.watchConflictCount();
});

class CartState {
  final List<CartItem> items;
  final bool isCheckingOut;
  final String? errorMessage;

  CartState({
    this.items = const [],
    this.isCheckingOut = false,
    this.errorMessage,
  });

  double get subtotal => SalePayloadBuilder.computeTotals(items).subtotal;
  double get taxTotal => SalePayloadBuilder.computeTotals(items).taxTotal;
  double get grandTotal => SalePayloadBuilder.computeTotals(items).grandTotal;

  int get totalQuantity =>
      items.fold(0, (sum, it) => sum + it.quantity.toInt());

  CartState copyWith({
    List<CartItem>? items,
    bool? isCheckingOut,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CartState(
      items: items ?? this.items,
      isCheckingOut: isCheckingOut ?? this.isCheckingOut,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class CartNotifier extends StateNotifier<CartState> {
  final AppDatabase database;
  final SyncQueueWorker syncWorker;
  final AuthSession? session;
  final _uuid = const Uuid();

  CartNotifier({
    required this.database,
    required this.syncWorker,
    this.session,
  }) : super(CartState());

  void addItem({
    required String productId,
    required String sku,
    required String name,
    required double price,
    double quantity = 1.0,
    double taxRate = 0.19,
    String? variantId,
    String? warehouseId,
  }) {
    final index = state.items.indexWhere((it) => it.productId == productId);
    if (index >= 0) {
      final existing = state.items[index];
      final updated = existing.copyWith(quantity: existing.quantity + quantity);
      final newItems = List<CartItem>.from(state.items);
      newItems[index] = updated;
      state = state.copyWith(items: newItems, clearError: true);
    } else {
      final newItem = CartItem(
        productId: productId,
        variantId: variantId ?? productId,
        warehouseId: warehouseId,
        sku: sku,
        name: name,
        quantity: quantity,
        unitPrice: price,
        taxRate: taxRate,
      );
      state =
          state.copyWith(items: [...state.items, newItem], clearError: true);
    }
  }

  void updateQuantity(String productId, double quantity) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    final index = state.items.indexWhere((it) => it.productId == productId);
    if (index >= 0) {
      final updated = state.items[index].copyWith(quantity: quantity);
      final newItems = List<CartItem>.from(state.items);
      newItems[index] = updated;
      state = state.copyWith(items: newItems, clearError: true);
    }
  }

  void removeItem(String productId) {
    state = state.copyWith(
      items: state.items.where((it) => it.productId != productId).toList(),
      clearError: true,
    );
  }

  void clearCart() {
    state = CartState();
  }

  /// Liquidación Offline-First: persiste la venta en la cola Outbox local
  /// (SQLite/Drift) con Idempotency-Key única y despierta al worker de sincronización.
  Future<bool> checkout({
    required String paymentMethod,
    required String customerId,
    required String customerName,
    required String customerDoc,
    String? branchId,
    String? warehouseId,
    String? posShiftId,
    String? cashierId,
    double? cashTendered,
    double? changeGiven,
  }) async {
    if (state.items.isEmpty) return false;

    final activeSession = session;
    if (activeSession == null || !activeSession.isAuthenticated) {
      state = state.copyWith(
        isCheckingOut: false,
        errorMessage:
            'Sesión no autenticada. Inicie sesión para registrar la venta.',
      );
      return false;
    }

    state = state.copyWith(isCheckingOut: true, clearError: true);

    try {
      final idempotencyKey = _uuid.v4();
      final syncItemId = _uuid.v4();

      final effectiveBranchId = (branchId != null && branchId.isNotEmpty)
          ? branchId
          : (activeSession.branchId.isNotEmpty
              ? activeSession.branchId
              : Environment.defaultBranchId);

      final payload = SalePayloadBuilder.build(
        items: state.items,
        tenantId: activeSession.tenantId,
        branchId: effectiveBranchId,
        cashierId: cashierId ??
            (activeSession.userId.isNotEmpty
                ? activeSession.userId
                : activeSession.tenantId),
        paymentMethod: paymentMethod,
        warehouseId: warehouseId ?? Environment.warehouseId,
        posShiftId: posShiftId ?? Environment.posShiftId,
        customerId: customerId,
        customerName: customerName,
        customerDocument: customerDoc,
        cashTendered: cashTendered,
        changeGiven: changeGiven,
      );

      // 1. Persistencia atómica en la cola Outbox local SQLite
      await database.insertSyncQueueItem(
        SyncQueueItemsCompanion(
          id: Value(syncItemId),
          idempotencyKey: Value(idempotencyKey),
          endpoint: const Value('/pos/checkout'),
          method: const Value('POST'),
          payloadJson: Value(jsonEncode(payload)),
          status: const Value('PENDING'),
          retryCount: const Value(0),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );

      // 2. Sincronización inmediata si hay conectividad; si falla o no hay red, queda PENDING
      await syncWorker.syncPendingItems();

      // 3. Limpiar carrito de compras
      clearCart();
      return true;
    } catch (e) {
      state = state.copyWith(
        isCheckingOut: false,
        errorMessage: 'Error al registrar venta local: $e',
      );
      return false;
    }
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, CartState>((ref) {
  final db = ref.watch(databaseProvider);
  final worker = ref.watch(syncWorkerProvider);
  final session = ref.watch(authSessionProvider);
  return CartNotifier(database: db, syncWorker: worker, session: session);
});
