import { test, expect } from '@playwright/test';

test.describe('Resiliencia y Manejo de Errores HTTP E2E', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'unisaas_access_token',
        value: 'mock-jwt-token-resilience',
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

  test('debe mostrar alerta de stock insuficiente o conflicto 409 sin perder los ítems del carrito', async ({ page }) => {
    // Interceptar checkout para devolver 409
    await page.route('**/api/v1/pos/checkout', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Conflicto: stock insuficiente',
        }),
      });
    });

    await page.goto('/pos');

    // Agregar producto y proceder al cobro
    await page.locator('[data-testid="product-card"], button:has-text("Gaseosa Cola")').first().click();
    await page.locator('[data-testid="pay-checkout-button"], button:has-text("Cobrar Venta")').click();

    await page.locator('[data-testid="cash-tendered-input"], input[type="number"]').fill('10000');
    await page.locator('[data-testid="confirm-checkout-btn"], button:has-text("Confirmar Pago")').click();

    // Debe mostrar banner de error 409 en el modal
    const errorBanner = page.locator('[data-testid="checkout-error-banner"], div:has-text("Conflicto de concurrencia")');
    await expect(errorBanner.first()).toBeVisible();
    await expect(errorBanner.first()).toContainText('Conflicto de concurrencia: stock insuficiente');

    // Cerrar modal y comprobar que el carrito NO se vació
    await page.click('button:has-text("Cancelar")');
    await expect(page.locator('[data-testid="cart-item"], div:has(h4:has-text("Gaseosa Cola"))').first()).toBeVisible();
  });

  test('debe manejar degradación temporal 503 con alerta clara al usuario', async ({ page }) => {
    await page.route('**/api/v1/pos/checkout', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Infraestructura degradada',
        }),
      });
    });

    await page.goto('/pos');
    await page.locator('[data-testid="product-card"], button:has-text("Gaseosa Cola")').first().click();
    await page.locator('[data-testid="pay-checkout-button"], button:has-text("Cobrar Venta")').click();

    await page.locator('[data-testid="cash-tendered-input"], input[type="number"]').fill('10000');
    await page.locator('[data-testid="confirm-checkout-btn"], button:has-text("Confirmar Pago")').click();

    const errorBanner = page.locator('[data-testid="checkout-error-banner"], div:has-text("Servicio no disponible")');
    await expect(errorBanner.first()).toBeVisible();
    await expect(errorBanner.first()).toContainText('Servicio no disponible temporalmente');
  });

  test('debe notificar sesión expirada 401 durante el cobro', async ({ page }) => {
    await page.route('**/api/v1/pos/checkout', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Token expirado',
        }),
      });
    });

    await page.goto('/pos');
    await page.locator('[data-testid="product-card"], button:has-text("Gaseosa Cola")').first().click();
    await page.locator('[data-testid="pay-checkout-button"], button:has-text("Cobrar Venta")').click();

    await page.locator('[data-testid="cash-tendered-input"], input[type="number"]').fill('10000');
    await page.locator('[data-testid="confirm-checkout-btn"], button:has-text("Confirmar Pago")').click();

    const errorBanner = page.locator('[data-testid="checkout-error-banner"], div:has-text("Sesión expirada")');
    await expect(errorBanner.first()).toBeVisible();
    await expect(errorBanner.first()).toContainText('Sesión expirada');
  });
});
