/**
 * Cliente HTTP Fuertemente Tipado para UniSaaS Web POS.
 *
 * Directivas de Arquitectura y Calidad:
 * 1. Implementado exclusivamente sobre fetch nativo (sin Axios ni SDKs pesados).
 * 2. Prohibido el acceso directo a PostgreSQL, Prisma o bases de datos desde Next.js.
 * 3. Manejo determinista de códigos de estado HTTP (400, 401, 403, 404, 409, 503).
 * 4. Tokens y credenciales se almacenan exclusivamente en memoria o cookies httpOnly (prohibido localStorage).
 * 5. Soporte nativo para idempotencia en checkout y captura del header X-Idempotent-Replay.
 */

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Sesión no autorizada o token expirado', data?: any) {
    super(401, message, data);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Acceso denegado o violación de inquilino', data?: any) {
    super(403, message, data);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Recurso no encontrado', data?: any) {
    super(404, message, data);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  public readonly code?: string;
  public readonly retryAfterSeconds?: number;

  constructor(message: string, data?: any, retryAfter?: number) {
    super(409, message, data);
    this.name = 'ConflictError';
    this.code = data?.code;
    this.retryAfterSeconds = retryAfter || data?.retryAfterSeconds;
  }
}

export class ServiceUnavailableError extends ApiError {
  public readonly retryAfterSeconds: number;
  public readonly retryAfter: number;

  constructor(message = 'Servicio degradado temporalmente (Redis/Base de datos)', retryAfterSeconds = 5, data?: any) {
    super(503, message, data);
    this.name = 'ServiceUnavailableError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.retryAfter = retryAfterSeconds;
  }
}

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  tenantId?: string;
  token?: string;
}

export interface ApiResponse<T> {
  data: T;
  statusCode: number;
  isReplay?: boolean;
}

export class UniSaasApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private tenantId: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  setTenantId(tenantId: string | null): void {
    this.tenantId = tenantId;
  }

  getTenantId(): string | null {
    return this.tenantId;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    const effectiveToken = options.token || this.token;
    if (effectiveToken) {
      headers.set('Authorization', `Bearer ${effectiveToken}`);
    }

    const effectiveTenantId = options.tenantId || this.tenantId;
    if (effectiveTenantId) {
      headers.set('X-Tenant-Id', effectiveTenantId);
    }

    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new ServiceUnavailableError(`Fallo de conexión al API Gateway: ${err.message}`, 5);
    }

    // Parsear cuerpo de respuesta
    let data: any = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    // Comprobar cabecera o payload de replay idempotente
    const isReplay = response.headers.get('x-idempotent-replay') === 'true' || Boolean(data?.isReplay);

    if (!response.ok) {
      const errorMsg = data?.message || response.statusText || 'Error en la petición';

      if (response.status === 401) {
        throw new UnauthorizedError(errorMsg, data);
      }
      if (response.status === 403) {
        throw new ForbiddenError(errorMsg, data);
      }
      if (response.status === 404) {
        throw new NotFoundError(errorMsg, data);
      }
      if (response.status === 409) {
        const retryAfter = Number(response.headers.get('retry-after')) || data?.retryAfterSeconds;
        throw new ConflictError(errorMsg, data, retryAfter);
      }
      if (response.status === 503) {
        const retryAfter = Number(response.headers.get('retry-after')) || 5;
        throw new ServiceUnavailableError(errorMsg, retryAfter, data);
      }

      throw new ApiError(response.status, errorMsg, data);
    }

    return {
      data: data as T,
      statusCode: response.status,
      isReplay,
    };
  }

  // ==========================================
  // AUTENTICACIÓN Y SESIONES
  // ==========================================
  readonly auth = {
    login: async (credentials: { email: string; password: string; tenantId?: string }) => {
      const res = await this.request<{ accessToken: string; expiresIn: number; user: any }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(credentials),
        },
      );
      if (res.data.accessToken) {
        this.setToken(res.data.accessToken);
        if (res.data.user?.tenantId) {
          this.setTenantId(res.data.user.tenantId);
        }
      }
      return res.data;
    },

    logout: async () => {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } finally {
        this.setToken(null);
        this.setTenantId(null);
      }
    },

    getSessions: async () => {
      const res = await this.request<any[]>('/auth/sessions', { method: 'GET' });
      return res.data;
    },
  };

  // ==========================================
  // INVENTARIO Y CATÁLOGO
  // ==========================================
  readonly inventory = {
    getProducts: async () => {
      const res = await this.request<any[]>('/inventory/products', { method: 'GET' });
      return res.data;
    },

    getProductById: async (id: string) => {
      const res = await this.request<any>(`/inventory/products/${id}`, { method: 'GET' });
      return res.data;
    },

    getStockBalances: async () => {
      const res = await this.request<any[]>('/inventory/stock/balances', { method: 'GET' });
      return res.data;
    },
  };

  // ==========================================
  // TURNOS DE CAJA POS
  // ==========================================
  readonly shifts = {
    getCurrentShift: async () => {
      const res = await this.request<any>('/sales/shifts/current', { method: 'GET' });
      return res.data;
    },

    openShift: async (dto: { branchId: string; initialCash: number }) => {
      const res = await this.request<any>('/sales/shifts/open', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      return res.data;
    },

    closeShift: async (shiftId: string, dto: { actualCash: number; notes?: string }) => {
      const res = await this.request<any>(`/sales/shifts/${shiftId}/close`, {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      return res.data;
    },
  };

  // ==========================================
  // CHECKOUT POS (ORQUESTACIÓN ATÓMICA)
  // ==========================================
  readonly checkout = {
    execute: async (
      dto: {
        branchId: string;
        posShiftId?: string;
        items: Array<{
          productId: string;
          variantId: string;
          warehouseId: string;
          quantity: number;
          unitPrice: number;
          taxRate?: number;
          discountRate?: number;
        }>;
        payment: {
          method: 'EFECTIVO' | 'NEQUI' | 'DAVIPLATA' | 'TARJETA' | 'CREDITO_FIADO' | 'MIXTO';
          cashTendered?: number;
          customerDocument?: string;
          customerName?: string;
          customerId?: string;
        };
        printTicket?: boolean;
        ticketWidth?: 58 | 80;
      },
      idempotencyKey: string,
    ) => {
      const res = await this.request<any>('/pos/checkout', {
        method: 'POST',
        idempotencyKey,
        body: JSON.stringify(dto),
      });
      return {
        ...res.data,
        isReplay: res.isReplay,
      };
    },
  };

  // ==========================================
  // CLIENTES Y CARTERA / CRÉDITO
  // ==========================================
  readonly customers = {
    getCustomers: async () => {
      const res = await this.request<any[]>('/credits/third-parties', { method: 'GET' });
      return res.data;
    },

    getCustomerById: async (id: string) => {
      const res = await this.request<any>(`/credits/third-parties/${id}`, { method: 'GET' });
      return res.data;
    },
  };

  // ==========================================
  // SONDA DE SALUD (HEALTH CHECK)
  // ==========================================
  readonly health = {
    check: async () => {
      const res = await this.request<any>('/health', { method: 'GET' });
      return res.data;
    },
  };
}

// Instancia singleton para el cliente web
export const apiClient = new UniSaasApiClient();

