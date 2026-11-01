import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { usePosCartStore } from '../src/store/pos-cart.store.ts';

describe('PosCartStore Unit Tests', () => {
  beforeEach(() => {
    usePosCartStore.getState().clearCart();
  });

  it('debe agregar productos y calcular subtotal, IVA y total correctamente', () => {
    const store = usePosCartStore.getState();

    // Agregar producto con IVA 19% (base 3000 + 570 IVA = 3570 total)
    store.addItem({
      productId: 'p1',
      variantId: 'v1',
      warehouseId: 'w1',
      productName: 'Gaseosa Cola 500ml',
      productSku: 'COL-500',
      price: 3000,
      taxRate: 19,
    });

    const items = usePosCartStore.getState().items;
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 1);
    assert.equal(items[0].subtotal, 3000);
    assert.equal(items[0].taxAmount, 570);
    assert.equal(items[0].total, 3570);

    const total = usePosCartStore.getState().getTotal();
    assert.equal(total, 3570);

    // Agregar el mismo producto incrementa cantidad a 2 (total = 7140)
    usePosCartStore.getState().addItem({
      productId: 'p1',
      variantId: 'v1',
      warehouseId: 'w1',
      productName: 'Gaseosa Cola 500ml',
      productSku: 'COL-500',
      price: 3000,
      taxRate: 19,
    });

    const itemsAfter = usePosCartStore.getState().items;
    assert.equal(itemsAfter.length, 1);
    assert.equal(itemsAfter[0].quantity, 2);
    assert.equal(itemsAfter[0].total, 7140);
    assert.equal(usePosCartStore.getState().getTotal(), 7140);
  });

  it('debe actualizar la cantidad de un producto o eliminarlo si la cantidad llega a cero', () => {
    const store = usePosCartStore.getState();

    store.addItem({
      productId: 'p1',
      variantId: 'v1',
      warehouseId: 'w1',
      productName: 'Gaseosa Cola 500ml',
      productSku: 'COL-500',
      price: 3000,
      taxRate: 19,
    });

    // Actualizar cantidad a 5 (5 * 3570 = 17850)
    store.updateQuantity('v1', 5);
    assert.equal(usePosCartStore.getState().items[0].quantity, 5);
    assert.equal(usePosCartStore.getState().getTotal(), 17850);

    // Actualizar cantidad a 0 -> se elimina del carrito
    store.updateQuantity('v1', 0);
    assert.equal(usePosCartStore.getState().items.length, 0);
    assert.equal(usePosCartStore.getState().getTotal(), 0);
  });

  it('debe eliminar un producto específico con removeItem', () => {
    const store = usePosCartStore.getState();

    store.addItem({
      productId: 'p1',
      variantId: 'v1',
      warehouseId: 'w1',
      productName: 'Gaseosa Cola 500ml',
      productSku: 'COL-500',
      price: 3000,
      taxRate: 19,
    });

    store.addItem({
      productId: 'p2',
      variantId: 'v2',
      warehouseId: 'w1',
      productName: 'Arroz Diana 1kg',
      productSku: 'ARR-DIANA',
      price: 4800,
      taxRate: 0,
    });

    // Total: 3570 + 4800 = 8370
    assert.equal(usePosCartStore.getState().items.length, 2);
    assert.equal(usePosCartStore.getState().getTotal(), 8370);

    store.removeItem('v1');

    const remaining = usePosCartStore.getState().items;
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].variantId, 'v2');
    assert.equal(usePosCartStore.getState().getTotal(), 4800);
  });

  it('debe calcular el cambio/vueltos correctamente para pagos en efectivo', () => {
    const store = usePosCartStore.getState();

    store.addItem({
      productId: 'p1',
      variantId: 'v1',
      warehouseId: 'w1',
      productName: 'Gaseosa Cola 500ml',
      productSku: 'COL-500',
      price: 3000,
      taxRate: 19,
    });

    store.setPaymentMethod('EFECTIVO');
    // Total es 3570. Con 10000 entregados, cambio = 6430
    store.setCashTendered(10000);
    assert.equal(usePosCartStore.getState().getChangeGiven(), 6430);

    // Si el monto entregado es menor al total, el cambio es 0
    store.setCashTendered(2000);
    assert.equal(usePosCartStore.getState().getChangeGiven(), 0);
  });

  it('debe vaciar el carrito completamente con clearCart', () => {
    const store = usePosCartStore.getState();

    store.addItem({
      productId: 'p1',
      variantId: 'v1',
      warehouseId: 'w1',
      productName: 'Gaseosa Cola 500ml',
      productSku: 'COL-500',
      price: 3000,
      taxRate: 19,
    });

    store.setCashTendered(50000);
    store.clearCart();

    assert.equal(usePosCartStore.getState().items.length, 0);
    assert.equal(usePosCartStore.getState().cashTendered, 0);
    assert.equal(usePosCartStore.getState().getTotal(), 0);
  });
});
