/// Representa una línea en el carrito táctil del POS móvil.
class CartItem {
  final String productId;
  final String? variantId;
  final String? warehouseId;
  final String sku;
  final String name;
  final double quantity;
  final double unitPrice;
  final double taxRate;
  final double discountRate;

  const CartItem({
    required this.productId,
    this.variantId,
    this.warehouseId,
    required this.sku,
    required this.name,
    required this.quantity,
    required this.unitPrice,
    this.taxRate = 0.19,
    this.discountRate = 0.0,
  });

  CartItem copyWith({
    String? productId,
    String? variantId,
    String? warehouseId,
    String? sku,
    String? name,
    double? quantity,
    double? unitPrice,
    double? taxRate,
    double? discountRate,
  }) {
    return CartItem(
      productId: productId ?? this.productId,
      variantId: variantId ?? this.variantId,
      warehouseId: warehouseId ?? this.warehouseId,
      sku: sku ?? this.sku,
      name: name ?? this.name,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      taxRate: taxRate ?? this.taxRate,
      discountRate: discountRate ?? this.discountRate,
    );
  }

  double get lineTotal => (quantity * unitPrice * 100).roundToDouble() / 100;
}

