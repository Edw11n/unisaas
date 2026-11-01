import { test, expect } from '@playwright/test';

test.describe('Autenticación y Sesiones E2E', () => {
  test('debe redirigir a /login cuando no existe sesión activa', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('h2')).toContainText('UniSaaS POS Terminal');
  });

  test('debe mostrar error 401 cuando las credenciales son incorrectas', async ({ page }) => {
    // Interceptar /api/auth/login para simular 401 de credenciales inválidas
    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Credenciales inválidas' }),
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'incorrecto@tenant-a.com');
    await page.fill('[data-testid="login-password"]', 'WrongPassword!');
    await page.click('[data-testid="login-submit-btn"]');

    const errorBanner = page.locator('[data-testid="login-error-banner"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Credenciales inválidas');
  });

  test('debe iniciar sesión exitosamente y redirigir al terminal POS', async ({ page, context }) => {
    // Interceptar login con respuesta exitosa
    await page.route('/api/auth/login', async (route) => {
      // Simular cookie httpOnly seteada por Route Handler
      await context.addCookies([
        {
          name: 'unisaas_access_token',
          value: 'mock-jwt-token-playwright',
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

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            fullName: 'Carlos Cajero',
            role: 'CASHIER',
          },
        }),
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'cajero@tenant-a.com');
    await page.fill('[data-testid="login-password"]', 'Password123!');
    await page.click('[data-testid="login-submit-btn"]');

    await expect(page).toHaveURL(/.*\/pos/);
    await expect(page.locator('header')).toContainText('Carlos Cajero');
  });

  test('debe cerrar sesión y redirigir a /login al pulsar el botón de logout', async ({ page, context }) => {
    // Pre-establecer sesión
    await context.addCookies([
      {
        name: 'unisaas_access_token',
        value: 'mock-jwt-token-playwright',
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

    await page.goto('/pos');
    await expect(page.locator('header')).toContainText('Carlos Cajero');

    // Interceptar logout
    await page.route('/api/auth/logout', async (route) => {
      await context.clearCookies();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.click('[data-testid="logout-btn"], button[title="Cerrar Sesión"]');
    await expect(page).toHaveURL(/.*\/login/);
  });
});

