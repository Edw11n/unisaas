import { test, expect } from '@playwright/test';

test.describe('Checkout POS y Orquestación Atómica E2E', () => {
  test.beforeEach(async ({ context }) => {
    // Configurar sesión activa antes de cada prueba
    await context.addCookies([
      {
        name: 'unisaas_access_token',
        value: 'mock-jwt-token-pos-playwright',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      },
      {
        name: 'unisaas_user_data',
        value: JSON.stringify({
          id: 'c1111111-1111-1111-1111-111111111111',
          email: 'cajero@tenant-a.com',
          fullName: 'Carlos Cajero',
          role: 'CASHIER',
          tenantId: '11111111-1111-1111-1111-111111111111',
        }),
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('debe agregar productos al carrito, abrir checkout y liquidar en efectivo con cambio', async ({ page }) => {
    let capturedIdempotencyKey: string | null = null;

    // Interceptar llamada de checkout en el API Gateway
    await page.route('**/api/v1/pos/checkout', async (route) => {
      const headers = route.request().headers();
      capturedIdempotencyKey = headers['idempotency-key'] || null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoiceId: 'f9999999-1111-1111-1111-111111111111',
          consecutive: 'POS-20261101-00042',
          subtotal: 3000,
          discountTotal: 0,
          taxTotal: 570,
          total: 3570,
          paymentMethod: 'EFECTIVO',
          cashTendered: 10000,
          changeGiven: 6430,
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/pos');

    // 1. Verificar catálogo y hacer click en el primer producto
    const productCard = page.locator('[data-testid="product-card"], button:has-text("Gaseosa Cola")').first();
    await expect(productCard).toBeVisible();
    await productCard.click();

    // 2. Verificar que se agregó al carrito
    const cartItems = page.locator('[data-testid="cart-item"], div:has(h4:has-text("Gaseosa Cola"))');
    await expect(cartItems.first()).toBeVisible();

    // 3. Abrir modal de cobro
    const payBtn = page.locator('[data-testid="pay-checkout-button"], button:has-text("Cobrar Venta")');
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    // 4. Modal de Checkout visible
    const checkoutModal = page.locator('[data-testid="checkout-modal"], div:has(h2:has-text("Finalizar Venta POS"))');
    await expect(checkoutModal.first()).toBeVisible();

    // 5. Ingresar efectivo $10.000 y verificar vueltos
    const cashInput = page.locator('[data-testid="cash-tendered-input"], input[type="number"]');
    await cashInput.fill('10000');
    const changeAmount = page.locator('[data-testid="change-amount"], span:has-text("6.430")');
    await expect(changeAmount.first()).toContainText('6.430');

    // 6. Confirmar pago
    const confirmBtn = page.locator('[data-testid="confirm-checkout-btn"], button:has-text("Confirmar Pago")');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 7. Verificar que el modal de recibo se muestre con el consecutivo correcto
    const receiptModal = page.locator('[data-testid="receipt-modal"], div:has(h2:has-text("¡Venta Exitosa!"))');
    await expect(receiptModal.first()).toBeVisible();
    await expect(page.locator('[data-testid="invoice-consecutive"], span:has-text("POS-20261101-00042")').first()).toContainText('POS-20261101-00042');
    await expect(page.locator('[data-testid="receipt-total"], span:has-text("3.570")').first()).toContainText('3.570');
    await expect(page.locator('[data-testid="receipt-change"], span:has-text("6.430")').first()).toContainText('6.430');

    // Verificar que la cabecera Idempotency-Key fue inyectada
    expect(capturedIdempotencyKey).toBeTruthy();
    expect(capturedIdempotencyKey?.length).toBeGreaterThan(10);

    // 8. Iniciar nueva venta
    const newSaleBtn = page.locator('[data-testid="new-sale-btn"], button:has-text("Nueva Venta")');
    await newSaleBtn.click();
    await expect(receiptModal.first()).not.toBeVisible();
  });

  test('debe mostrar indicador de repetición idempotente cuando el backend devuelve x-idempotent-replay', async ({ page }) => {
    // Interceptar checkout simulando replay idempotente
    await page.route('**/api/v1/pos/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'x-idempotent-replay': 'true',
          'access-control-expose-headers': 'x-idempotent-replay',
        },
        contentType: 'application/json',
        body: JSON.stringify({
          invoiceId: 'f9999999-1111-1111-1111-111111111111',
          consecutive: 'POS-20261101-00042',
          subtotal: 3000,
          discountTotal: 0,
          taxTotal: 570,
          total: 3570,
          paymentMethod: 'EFECTIVO',
          cashTendered: 5000,
          changeGiven: 1430,
          isReplay: true,
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/pos');

    // Agregar producto y proceder al cobro
    await page.locator('[data-testid="product-card"], button:has-text("Gaseosa Cola")').first().click();
    await page.locator('[data-testid="pay-checkout-button"], button:has-text("Cobrar Venta")').click();

    await page.locator('[data-testid="cash-tendered-input"], input[type="number"]').fill('5000');
    await page.locator('[data-testid="confirm-checkout-btn"], button:has-text("Confirmar Pago")').click();

    // Verificar que el badge de repetición idempotente esté visible
    const replayBadge = page.locator('[data-testid="idempotent-replay-badge"], div:has-text("REPETICIÓN IDEMPOTENTE")');
    await expect(replayBadge.first()).toBeVisible();
    await expect(replayBadge.first()).toContainText('REPETICIÓN IDEMPOTENTE');
  });
});
