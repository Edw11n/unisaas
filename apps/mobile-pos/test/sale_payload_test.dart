import 'package:flutter_test/flutter_test.dart';
import 'package:unisaas_mobile_pos/features/pos/models/cart_item.dart';
import 'package:unisaas_mobile_pos/features/pos/models/sale_payload.dart';

void main() {
  group('SalePayloadBuilder (contrato /api/checkout del BFF)', () {
    final items = [
      const CartItem(
        productId: 'prod-1',
        sku: 'SKU-1',
        name: 'Cafe Americano',
        quantity: 1,
        unitPrice: 12000,
        taxRate: 0.19,
      ),
      const CartItem(
        productId: 'prod-2',
        sku: 'SKU-2',
        name: 'Hamburguesa',
        quantity: 2,
        unitPrice: 35000,
        taxRate: 0.19,
      ),
    ];

    test('el total es la suma de precios con IVA incluido', () {
      final totals = SalePayloadBuilder.computeTotals(items);

      expect(totals.grandTotal, closeTo(82000, 0.01));
      expect(
          totals.subtotal + totals.taxTotal, closeTo(totals.grandTotal, 0.1));
    });

    test('subtotal y IVA no alteran el total final', () {
      final totals = SalePayloadBuilder.computeTotals(items);

      expect(totals.subtotal, closeTo(68907.56, 0.05));
      expect(totals.taxTotal, closeTo(13092.44, 0.05));
    });

    test('mapea los medios de pago del POS a los del BFF', () {
      expect(SalePayloadBuilder.normalizePaymentMethod('Efectivo'), 'EFECTIVO');
      expect(SalePayloadBuilder.normalizePaymentMethod('Datafono'), 'TARJETA');
      expect(
        SalePayloadBuilder.normalizePaymentMethod('Billetera Digital'),
        'TRANSFERENCIA',
      );
    });

    test('el payload incluye tenant, sucursal, cajero e items reales', () {
      final payload = SalePayloadBuilder.build(
        items: items,
        tenantId: 'tenant-01',
        branchId: 'branch-01',
        cashierId: 'user-01',
        paymentMethod: 'Efectivo',
      );

      expect(payload['tenantId'], 'tenant-01');
      expect(payload['branchId'], 'branch-01');
      expect(payload['cashierId'], 'user-01');
      expect(payload['paymentMethod'], 'EFECTIVO');
      expect(payload['grandTotal'], closeTo(82000, 0.01));
      expect(payload['discountTotal'], 0.0);
      expect((payload['items'] as List).length, 2);

      // Sin define de bodega/turno no se envian claves vacias.
      expect(payload.containsKey('warehouseId'), isFalse);
      expect(payload.containsKey('posShiftId'), isFalse);
    });
  });
}
