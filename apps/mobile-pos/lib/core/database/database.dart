import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

part 'database.g.dart';

// Tabla local de productos para venta offline inmediata
class LocalProducts extends Table {
  TextColumn get id => text()();
  TextColumn get serverId => text()();
  TextColumn get sku => text()();
  TextColumn get barcode => text().nullable()();
  TextColumn get name => text()();
  RealColumn get salePrice => real()();
  RealColumn get taxRate => real().withDefault(const Constant(0.19))();
  RealColumn get stockOnHand => real().withDefault(const Constant(0.0))();
  TextColumn get unitOfMeasure =>
      text().withDefault(const Constant('UNIDAD'))();
  TextColumn get category => text().withDefault(const Constant('General'))();

  @override
  Set<Column> get primaryKey => {id};
}

// Cola transaccional Outbox para sincronización asíncrona segura con el backend
class SyncQueueItems extends Table {
  TextColumn get id => text()();
  TextColumn get idempotencyKey => text()();
  TextColumn get endpoint => text()();
  TextColumn get method => text().withDefault(const Constant('POST'))();
  TextColumn get payloadJson => text()();
  TextColumn get status => text().withDefault(
      const Constant('PENDING'))(); // PENDING, SYNCED, FAILED, CONFLICT
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  TextColumn get lastError => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

// Tabla local de clientes y cartera para validación de cupo offline en ruta
class LocalCustomers extends Table {
  TextColumn get id => text()();
  TextColumn get documentNumber => text()();
  TextColumn get name => text()();
  RealColumn get creditLimit => real().withDefault(const Constant(0.0))();
  RealColumn get currentDebt => real().withDefault(const Constant(0.0))();

  @override
  Set<Column> get primaryKey => {id};
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    try {
      final dbFolder = await getApplicationDocumentsDirectory();
      final file = File(p.join(dbFolder.path, 'unisaas_mobile_pos.sqlite'));
      return NativeDatabase.createInBackground(file);
    } catch (_) {
      return NativeDatabase.memory();
    }
  });
}

@DriftDatabase(tables: [LocalProducts, SyncQueueItems, LocalCustomers])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? e]) : super(e ?? _openConnection());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.addColumn(localProducts, localProducts.category);
          }
        },
      );

  // Consultas de Productos
  Future<List<LocalProduct>> getAllProducts() => select(localProducts).get();

  Stream<List<LocalProduct>> watchAllProducts() =>
      select(localProducts).watch();

  Future<LocalProduct?> getProductByBarcode(String barcode) =>
      (select(localProducts)..where((tbl) => tbl.barcode.equals(barcode)))
          .getSingleOrNull();

  Future<void> upsertProducts(List<LocalProduct> items) async {
    await batch((batch) {
      batch.insertAllOnConflictUpdate(localProducts, items);
    });
  }

  // Cola Outbox (Sync Queue)
  Future<List<SyncQueueItem>> getPendingSyncItems() => (select(syncQueueItems)
        ..where((tbl) => tbl.status.equals('PENDING'))
        ..orderBy([(t) => OrderingTerm(expression: t.createdAt)]))
      .get();

  Stream<int> watchPendingCount() {
    final count = syncQueueItems.id.count();
    final query = selectOnly(syncQueueItems)
      ..addColumns([count])
      ..where(syncQueueItems.status.equals('PENDING'));
    return query.map((row) => row.read(count) ?? 0).watchSingle();
  }

  Future<int> insertSyncQueueItem(SyncQueueItemsCompanion entry) =>
      into(syncQueueItems).insert(entry);

  Future<bool> markItemSynced(String id) async {
    final count = await (update(syncQueueItems)
          ..where((tbl) => tbl.id.equals(id)))
        .write(SyncQueueItemsCompanion(
      status: const Value('SYNCED'),
      updatedAt: Value(DateTime.now()),
    ));
    return count > 0;
  }

  Future<bool> markItemFailed(String id, String error,
      {int maxRetries = 5}) async {
    final current = await (select(syncQueueItems)
          ..where((tbl) => tbl.id.equals(id)))
        .getSingleOrNull();
    final nextRetry = (current?.retryCount ?? 0) + 1;
    final count = await (update(syncQueueItems)
          ..where((tbl) => tbl.id.equals(id)))
        .write(SyncQueueItemsCompanion(
      status: Value(nextRetry > maxRetries ? 'FAILED' : 'PENDING'),
      retryCount: Value(nextRetry),
      lastError: Value(error),
      updatedAt: Value(DateTime.now()),
    ));
    return count > 0;
  }

  /// Marca explícitamente un ítem en estado de conflicto (HTTP 409).
  ///
  /// No se reintenta indefinidamente en el worker. Se preserva el payload original,
  /// la idempotencyKey y el detalle del conflicto para auditoría o resolución.
  Future<bool> markItemConflict(String id, String conflictDetails) async {
    final count = await (update(syncQueueItems)
          ..where((tbl) => tbl.id.equals(id)))
        .write(SyncQueueItemsCompanion(
      status: const Value('CONFLICT'),
      lastError: Value(conflictDetails),
      updatedAt: Value(DateTime.now()),
    ));
    return count > 0;
  }

  Future<List<SyncQueueItem>> getConflictSyncItems() => (select(syncQueueItems)
        ..where((tbl) => tbl.status.equals('CONFLICT'))
        ..orderBy([(t) => OrderingTerm(expression: t.createdAt)]))
      .get();

  Stream<int> watchConflictCount() {
    final count = syncQueueItems.id.count();
    final query = selectOnly(syncQueueItems)
      ..addColumns([count])
      ..where(syncQueueItems.status.equals('CONFLICT'));
    return query.map((row) => row.read(count) ?? 0).watchSingle();
  }

  Future<SyncQueueItem?> getSyncItemById(String id) =>
      (select(syncQueueItems)..where((tbl) => tbl.id.equals(id)))
          .getSingleOrNull();

  Future<SyncQueueItem?> getSyncItemByIdempotencyKey(String key) =>
      (select(syncQueueItems)..where((tbl) => tbl.idempotencyKey.equals(key)))
          .getSingleOrNull();

  Future<bool> retryConflictItem(String id) async {
    final count = await (update(syncQueueItems)
          ..where((tbl) => tbl.id.equals(id)))
        .write(SyncQueueItemsCompanion(
      status: const Value('PENDING'),
      retryCount: const Value(0),
      updatedAt: Value(DateTime.now()),
    ));
    return count > 0;
  }
}
