import 'dart:math' as math;

import 'cart_item.dart';

/// Totales de una venta calculados con precisión monetaria (2 decimales):
/// el precio de venta en el POS es FINAL con IVA incluido.
class SaleTotals {
  final double subtotal;
  final double taxTotal;
  final double grandTotal;

  const SaleTotals({
    required this.subtotal,
    required this.taxTotal,
    required this.grandTotal,
  });
}

/// Constructor unificado del payload de Checkout para el backend NestJS.
///
/// Diseñado para garantizar consistencia matemática entre el cliente móvil y
/// la transacción atómica de checkout de PostgreSQL.
class SalePayloadBuilder {
  SalePayloadBuilder._();

  static double round2(double value) => (value * 100).roundToDouble() / 100;

  /// Normaliza los métodos de pago al enum soportado por NestJS y PostgreSQL.
  static String normalizePaymentMethod(String method) {
    final normalized = method.trim().toUpperCase();
    switch (normalized) {
      case 'EFECTIVO':
      case 'CASH':
        return 'EFECTIVO';
      case 'DATAFONO':
      case 'TARJETA':
      case 'CARD':
        return 'TARJETA';
      case 'NEQUI':
        return 'NEQUI';
      case 'DAVIPLATA':
        return 'DAVIPLATA';
      case 'BILLETERA DIGITAL':
      case 'TRANSFERENCIA':
      case 'TRANSFER':
        return 'TRANSFERENCIA';
      case 'CREDITO':
      case 'CREDITO_FIADO':
      case 'FIADO':
        return 'CREDITO_FIADO';
      default:
        return 'EFECTIVO';
    }
  }

  /// Calcula los totales del carrito con IVA incluido.
  static SaleTotals computeTotals(List<CartItem> items) {
    double subtotal = 0;
    double taxTotal = 0;
    double grandTotal = 0;

    for (final item in items) {
      if (item.quantity <= 0) continue;
      final rate = item.taxRate < 0 ? 0.0 : item.taxRate;
      final lineTotal = round2(item.quantity * item.unitPrice);
      final base = round2(lineTotal / (1 + rate));
      subtotal += base;
      taxTotal += round2(lineTotal - base);
      grandTotal += lineTotal;
    }

    return SaleTotals(
      subtotal: round2(subtotal),
      taxTotal: round2(taxTotal),
      grandTotal: round2(grandTotal),
    );
  }

  /// Construye el payload completo de checkout para `/api/v1/pos/checkout`.
  static Map<String, dynamic> build({
    required List<CartItem> items,
    required String tenantId,
    required String branchId,
    required String cashierId,
    required String paymentMethod,
    String? warehouseId,
    String? posShiftId,
    String customerId = 'cust-final',
    String customerName = 'Consumidor Final',
    String customerDocument = '222222222222',
    double? cashTendered,
    double? changeGiven,
  }) {
    final totals = computeTotals(items);
    final normalizedMethod = normalizePaymentMethod(paymentMethod);
    final tender = round2(cashTendered ?? totals.grandTotal);
    final change =
        round2(changeGiven ?? math.max(0, tender - totals.grandTotal));

    final effectiveWarehouseId = (warehouseId != null && warehouseId.isNotEmpty)
        ? warehouseId
        : '11111111-1111-1111-1111-111111111111';

    // Formatear items tanto en formato estructurado NestJS como en formato plano
    final checkoutItems = items.where((item) => item.quantity > 0).map((item) {
      final lineTotal = round2(item.quantity * item.unitPrice);
      final base = round2(lineTotal / (1 + item.taxRate));
      return {
        'productId': item.productId,
        'variantId': item.variantId ?? item.productId,
        'warehouseId': item.warehouseId ?? effectiveWarehouseId,
        'sku': item.sku,
        'name': item.name,
        'quantity': item.quantity,
        'unitPrice': item.unitPrice,
        'taxRate': item.taxRate,
        'discountRate': item.discountRate,
        'subtotal': base,
        'taxAmount': round2(lineTotal - base),
        'total': lineTotal,
      };
    }).toList(growable: false);

    final payload = <String, dynamic>{
      'tenantId': tenantId,
      'branchId': branchId,
      'cashierId': cashierId,
      'customerId': customerId,
      'customerName': customerName,
      'customerDocument': customerDocument,
      'paymentMethod': normalizedMethod,
      'cashTendered': tender,
      'changeGiven': change,
      'subtotal': totals.subtotal,
      'discountTotal': 0.0,
      'taxTotal': totals.taxTotal,
      'grandTotal': totals.grandTotal,
      'printThermalReceipt': true,
      'items': checkoutItems,
      // Objeto de pago estructurado para CheckoutDto
      'payment': {
        'method': normalizedMethod,
        'cashTendered': tender,
        'customerDocument': customerDocument,
        'customerName': customerName,
        'customerId': customerId,
      },
    };

    if (warehouseId != null && warehouseId.isNotEmpty) {
      payload['warehouseId'] = warehouseId;
    }
    if (posShiftId != null && posShiftId.isNotEmpty) {
      payload['posShiftId'] = posShiftId;
    }

    return payload;
  }
}
