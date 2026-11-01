import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/config/environment.dart';
import '../../../core/database/database.dart';
import '../../../core/network/api_client.dart';
import '../../../core/session/session.dart';
import '../models/cart_item.dart';
import '../models/sale_payload.dart';
import '../providers/pos_providers.dart';

/// Linea del carrito del POS. El producto proviene del catalogo local
/// (SQLite/Drift) descargado del BFF, no de una lista hardcodeada.
class PosCartLine {
  final LocalProduct product;
  int quantity;
  final String size;

  PosCartLine({
    required this.product,
    this.quantity = 1,
    this.size = 'Porcion Regular',
  });

  CartItem toCartItem() => CartItem(
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: quantity.toDouble(),
        unitPrice: product.salePrice,
        taxRate: product.taxRate,
      );
}

class MobilePosScreen extends ConsumerStatefulWidget {
  const MobilePosScreen({super.key});

  @override
  ConsumerState<MobilePosScreen> createState() => _MobilePosScreenState();
}

class _MobilePosScreenState extends ConsumerState<MobilePosScreen> {
  String _selectedCategory = 'Todas';
  String _orderType = 'En Mesa'; // En Mesa, Para Llevar, Domicilio
  String _paymentMethod = 'Efectivo'; // Efectivo, Datafono, Billetera Digital
  final Set<String> _favorites = {};
  final List<PosCartLine> _cart = [];
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  bool _isSyncingCatalog = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Arranca el worker periodico de la cola Outbox.
      ref.read(syncWorkerProvider);
      final session = ref.read(authSessionProvider);
      if (session != null && session.isAuthenticated) {
        _syncCatalog(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatCop(double value) {
    final intVal = value.round();
    final str = intVal.toString();
    final buffer = StringBuffer();
    int count = 0;
    for (int i = str.length - 1; i >= 0; i--) {
      buffer.write(str[i]);
      count++;
      if (count % 3 == 0 && i != 0) {
        buffer.write('.');
      }
    }
    return '\$ ${buffer.toString().split('').reversed.join('')}';
  }

  List<CartItem> get _cartItems =>
      _cart.map((line) => line.toCartItem()).toList(growable: false);

  SaleTotals get _totals => SalePayloadBuilder.computeTotals(_cartItems);

  double get _itemsTotal => _totals.subtotal;

  double get _taxTotal => _totals.taxTotal;

  double get _totalAmount => _totals.grandTotal;

  int get _totalCount => _cart.fold(0, (sum, line) => sum + line.quantity);

  // ---------------------------------------------------------------------------
  // Catalogo real: BFF -> SQLite/Drift -> UI
  // ---------------------------------------------------------------------------
  Future<void> _syncCatalog({bool silent = false}) async {
    if (_isSyncingCatalog) return;
    if (Environment.useMockBackend) {
      if (!silent) _showMessage('Modo demo activo: no se consulta el backend.');
      return;
    }

    setState(() => _isSyncingCatalog = true);
    try {
      final client = ref.read(apiClientProvider);
      final db = ref.read(databaseProvider);
      final products = await client.fetchProducts();

      final localProducts = products
          .map(_mapProduct)
          .whereType<LocalProduct>()
          .toList(growable: false);

      if (localProducts.isNotEmpty) {
        await db.upsertProducts(localProducts);
      }

      if (!mounted) return;
      _showMessage(
        localProducts.isEmpty
            ? 'El backend no devolvio productos para este tenant.'
            : 'Catalogo sincronizado: ${localProducts.length} productos.',
        isError: localProducts.isEmpty,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      final message = e.isUnauthorized
          ? 'Sesion expirada o no autorizada. Inicie sesion nuevamente.'
          : 'No se pudo sincronizar el catalogo: ${e.message}';
      if (!silent) _showMessage(message, isError: true);
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        _showMessage('Modo offline activo: ${_describeError(e)}',
            isError: true);
      }
    } finally {
      if (mounted) setState(() => _isSyncingCatalog = false);
    }
  }

  /// Normaliza el JSON del BFF (`/api/inventory/products`) al esquema Drift.
  LocalProduct? _mapProduct(Map<String, dynamic> json) {
    final id = (json['id'] ?? json['productId'] ?? '').toString();
    if (id.isEmpty) return null;

    final salePrice = _asDouble(json['salePrice'] ?? json['price']);
    final stock = _asDouble(json['currentStock'] ?? json['stock']);

    return LocalProduct(
      id: id,
      serverId: (json['serverId'] ?? id).toString(),
      sku: (json['sku'] ?? 'SKU-$id').toString(),
      barcode: json['barcode']?.toString(),
      name: (json['name'] ?? 'Producto sin nombre').toString(),
      salePrice: salePrice,
      taxRate: json['taxRate'] == null ? 0.19 : _asDouble(json['taxRate']),
      stockOnHand: stock,
      unitOfMeasure: (json['unit'] ?? 'UND').toString(),
      category: (json['category'] ?? 'General').toString(),
    );
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0.0;
  }

  String _describeError(Object error) {
    if (error is ApiException) return error.message;
    return error.toString().replaceFirst('Exception: ', '');
  }

  void _showMessage(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor:
            isError ? const Color(0xFF334155) : const Color(0xFF0066FF),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Cola Outbox: la venta se persiste local y luego se sincroniza
  // ---------------------------------------------------------------------------
  Future<void> _recordOfflineSale({
    required List<PosCartLine> items,
    required String method,
  }) async {
    if (items.isEmpty) return;

    final session = ref.read(authSessionProvider);
    if (session == null || !session.isAuthenticated) {
      _showMessage('Sesion no autenticada: no se puede registrar la venta.',
          isError: true);
      return;
    }

    try {
      final db = ref.read(databaseProvider);
      final idempotencyKey = const Uuid().v4();
      final syncItemId = const Uuid().v4();

      final payload = SalePayloadBuilder.build(
        items: items.map((line) => line.toCartItem()).toList(growable: false),
        tenantId: session.tenantId,
        branchId: session.branchId,
        cashierId:
            session.userId.isNotEmpty ? session.userId : session.tenantId,
        paymentMethod: method,
        warehouseId: Environment.warehouseId,
        posShiftId: Environment.posShiftId,
        customerId: Environment.finalCustomerId,
      );

      await db.insertSyncQueueItem(
        SyncQueueItemsCompanion(
          id: Value(syncItemId),
          idempotencyKey: Value(idempotencyKey),
          endpoint: const Value('/api/checkout'),
          method: const Value('POST'),
          payloadJson: Value(jsonEncode(payload)),
          status: const Value('PENDING'),
          retryCount: const Value(0),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );

      // Si hay red se envia de inmediato; si no, queda PENDING y el worker
      // periodico la reintenta.
      await ref.read(syncWorkerProvider).syncPendingItems();
    } catch (e) {
      debugPrint('Error registrando venta en cola SQLite Drift: $e');
      _showMessage(
          'Venta guardada localmente con advertencia: ${_describeError(e)}',
          isError: true);
    }
  }

  void _addToCart(LocalProduct product) {
    setState(() {
      final index = _cart.indexWhere((l) => l.product.id == product.id);
      if (index >= 0) {
        _cart[index].quantity += 1;
      } else {
        _cart.add(PosCartLine(product: product, quantity: 1));
      }
    });
  }

  void _updateQuantity(String id, int delta) {
    setState(() {
      final index = _cart.indexWhere((l) => l.product.id == id);
      if (index >= 0) {
        _cart[index].quantity += delta;
        if (_cart[index].quantity <= 0) {
          _cart.removeAt(index);
        }
      }
    });
  }

  void _removeItem(String id) {
    setState(() {
      _cart.removeWhere((l) => l.product.id == id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(localProductsProvider);
    final products = productsAsync.maybeWhen(
      data: (value) => value,
      orElse: () => const <LocalProduct>[],
    );
    final pendingSync = ref.watch(pendingSyncCountProvider).maybeWhen(
          data: (count) => count,
          orElse: () => 0,
        );
    final session = ref.watch(authSessionProvider);

    final categories = <String>[
      'Todas',
      ...products
          .map((p) => p.category.trim())
          .where((c) => c.isNotEmpty)
          .toSet()
          .toList()
        ..sort(),
    ];
    final activeCategory =
        categories.contains(_selectedCategory) ? _selectedCategory : 'Todas';

    final query = _searchQuery.trim().toLowerCase();
    final filtered = products.where((product) {
      final matchesCategory =
          activeCategory == 'Todas' || product.category == activeCategory;
      if (!matchesCategory) return false;
      if (query.isEmpty) return true;
      return product.name.toLowerCase().contains(query) ||
          product.sku.toLowerCase().contains(query) ||
          (product.barcode ?? '').toLowerCase().contains(query);
    }).toList(growable: false);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Header: fecha, titulo y buscador
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back,
                                  color: Color(0xFF1E293B)),
                              onPressed: () => Navigator.of(context).pop(),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    session?.role.isNotEmpty == true
                                        ? 'Jornada en Vivo - ${session!.role}'
                                        : 'Jornada en Vivo - POS Movil',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF94A3B8),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    (session?.fullName.isNotEmpty ?? false)
                                        ? session!.fullName
                                        : 'Punto de Venta',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF0F172A),
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Sincronizacion de catalogo con el BFF
                      InkWell(
                        onTap: _isSyncingCatalog ? null : _syncCatalog,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: _isSyncingCatalog
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.sync,
                                  size: 20, color: Color(0xFF0066FF)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Cola de sincronizacion pendiente
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              pendingSync == 0
                                  ? Icons.cloud_done_outlined
                                  : Icons.cloud_upload_outlined,
                              size: 18,
                              color: pendingSync == 0
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFFF59E0B),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '$pendingSync',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Barra de busqueda
                  Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Row(
                      children: [
                        const Icon(Icons.search,
                            size: 18, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _searchController,
                            onChanged: (value) =>
                                setState(() => _searchQuery = value),
                            decoration: const InputDecoration(
                              hintText:
                                  'Buscar por nombre, SKU o codigo de barras...',
                              hintStyle: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF94A3B8),
                                fontWeight: FontWeight.w500,
                              ),
                              border: InputBorder.none,
                              isDense: true,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Selector horizontal de categorias reales
            Container(
              height: 42,
              margin: const EdgeInsets.symmetric(vertical: 6),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, idx) {
                  final cat = categories[idx];
                  final isSelected = activeCategory == cat;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedCategory = cat),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color:
                            isSelected ? const Color(0xFF0066FF) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF0066FF)
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          cat,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF475569),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            // Cuadricula de productos
            Expanded(
              child: productsAsync.isLoading && products.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : filtered.isEmpty
                      ? _buildEmptyCatalog(products.isEmpty)
                      : GridView.builder(
                          padding: const EdgeInsets.all(16),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 0.78,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (context, idx) =>
                              _buildProductCard(filtered[idx]),
                        ),
            ),

            // Barra inferior de pedido
            _buildBottomOrderBar(context),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyCatalog(bool catalogIsEmpty) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inventory_2_outlined,
                size: 56, color: Color(0xFF94A3B8)),
            const SizedBox(height: 12),
            Text(
              catalogIsEmpty
                  ? 'Sin productos sincronizados'
                  : 'Ningun producto coincide con el filtro',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              catalogIsEmpty
                  ? 'Descargue el catalogo real del BFF para vender.'
                  : 'Ajuste la categoria o el termino de busqueda.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            if (catalogIsEmpty) ...[
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _isSyncingCatalog ? null : _syncCatalog,
                icon: const Icon(Icons.cloud_download_outlined, size: 18),
                label: const Text('Sincronizar catalogo'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0066FF),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildProductCard(LocalProduct item) {
    final isFav = _favorites.contains(item.id);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF4FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.inventory_2_outlined,
                    size: 18, color: Color(0xFF0066FF)),
              ),
              GestureDetector(
                onTap: () {
                  setState(() {
                    if (isFav) {
                      _favorites.remove(item.id);
                    } else {
                      _favorites.add(item.id);
                    }
                  });
                },
                child: Icon(
                  isFav ? Icons.favorite : Icons.favorite_border,
                  size: 18,
                  color: isFav ? Colors.redAccent : const Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            item.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            item.sku,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  _formatCop(item.salePrice),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0066FF),
                  ),
                ),
              ),
              Text(
                'Stock ${item.stockOnHand.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0066FF),
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 6),
                minimumSize: const Size(0, 30),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () => _addToCart(item),
              child: const Text('Agregar',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomOrderBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFF1F5F9))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$_totalCount items seleccionados',
                  style:
                      const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
                Text(
                  _formatCop(_totalAmount),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0066FF),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0066FF),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: () => _showMyOrderSheet(context),
                child: const Text(
                  'Mi Pedido / Cobro',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMyOrderSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Resumen del Pedido',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Tipo de pedido
                  Row(
                    children:
                        ['En Mesa', 'Para Llevar', 'Domicilio'].map((type) {
                      final isSelected = _orderType == type;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              backgroundColor: isSelected
                                  ? const Color(0xFF0066FF)
                                  : Colors.white,
                              foregroundColor: isSelected
                                  ? Colors.white
                                  : const Color(0xFF0066FF),
                              side: const BorderSide(color: Color(0xFF0066FF)),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20)),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                            onPressed: () {
                              setModalState(() => _orderType = type);
                              setState(() => _orderType = type);
                            },
                            child: Text(type,
                                style: const TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 16),

                  // Items del carrito
                  if (_cart.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'No hay productos en el pedido.',
                        style:
                            TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _cart.length,
                      separatorBuilder: (_, __) =>
                          const Divider(color: Color(0xFFF1F5F9)),
                      itemBuilder: (context, idx) {
                        final line = _cart[idx];
                        return Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.inventory_2_outlined,
                                  size: 20, color: Color(0xFF0066FF)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    line.product.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800),
                                  ),
                                  Text(
                                    line.size,
                                    style: const TextStyle(
                                        fontSize: 10, color: Color(0xFF94A3B8)),
                                  ),
                                  Text(
                                    _formatCop(line.product.salePrice),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF0066FF),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Stepper
                            Container(
                              decoration: BoxDecoration(
                                border:
                                    Border.all(color: const Color(0xFFE2E8F0)),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  InkWell(
                                    onTap: () {
                                      _updateQuantity(line.product.id, 1);
                                      setModalState(() {});
                                    },
                                    child: const Padding(
                                      padding: EdgeInsets.all(4),
                                      child: Icon(Icons.add, size: 14),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6),
                                    child: Text(
                                      line.quantity < 10
                                          ? '0${line.quantity}'
                                          : '${line.quantity}',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  InkWell(
                                    onTap: () {
                                      _updateQuantity(line.product.id, -1);
                                      setModalState(() {});
                                    },
                                    child: const Padding(
                                      padding: EdgeInsets.all(4),
                                      child: Icon(Icons.remove, size: 14),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.delete_outline,
                                  size: 18, color: Colors.grey),
                              onPressed: () {
                                _removeItem(line.product.id);
                                setModalState(() {});
                              },
                            ),
                          ],
                        );
                      },
                    ),

                  const SizedBox(height: 16),

                  // Totales (precios con IVA incluido, criterio del BFF)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Subtotal sin IVA',
                          style: TextStyle(
                              color: Color(0xFF64748B), fontSize: 13)),
                      Text(_formatCop(_itemsTotal),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0066FF))),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('IVA incluido',
                          style: TextStyle(
                              color: Color(0xFF64748B), fontSize: 13)),
                      Text(_formatCop(_taxTotal),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF475569))),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total a Pagar',
                          style: TextStyle(
                              fontWeight: FontWeight.w900, fontSize: 16)),
                      Text(_formatCop(_totalAmount),
                          style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 18,
                              color: Color(0xFF0066FF))),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Medios de pago
                  const Text('Medio de Pago',
                      style:
                          TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  const SizedBox(height: 8),
                  Row(
                    children:
                        ['Efectivo', 'Datafono', 'Billetera Digital'].map((m) {
                      final isSelected = _paymentMethod == m;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isSelected
                                  ? const Color(0xFF0066FF)
                                  : Colors.white,
                              foregroundColor: isSelected
                                  ? Colors.white
                                  : const Color(0xFF475569),
                              elevation: 0,
                              side: BorderSide(
                                  color: isSelected
                                      ? const Color(0xFF0066FF)
                                      : const Color(0xFFE2E8F0)),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                            onPressed: () {
                              setModalState(() => _paymentMethod = m);
                              setState(() => _paymentMethod = m);
                            },
                            child: Text(m,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 20),

                  // Completar venta
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0066FF),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: () {
                        if (_cart.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content:
                                  Text('Agregue productos antes de cobrar.'),
                              backgroundColor: Color(0xFF334155),
                            ),
                          );
                          return;
                        }

                        final itemsToCheckout = _cart
                            .map((line) => PosCartLine(
                                  product: line.product,
                                  quantity: line.quantity,
                                  size: line.size,
                                ))
                            .toList(growable: false);
                        final selectedMethod = _paymentMethod;

                        final messenger = ScaffoldMessenger.of(context);
                        Navigator.of(context).pop();
                        setState(() {
                          _cart.clear();
                        });

                        messenger.showSnackBar(
                          const SnackBar(
                            content: Text(
                                'Venta completada con exito en mostrador.'),
                            backgroundColor: Color(0xFF0066FF),
                          ),
                        );

                        _recordOfflineSale(
                            items: itemsToCheckout, method: selectedMethod);
                      },
                      child: const Text('Completar Venta / Cobrar',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
