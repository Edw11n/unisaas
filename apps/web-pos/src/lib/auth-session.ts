import { cookies } from 'next/headers';

export const AUTH_COOKIE_NAME = 'unisaas_access_token';
export const TENANT_COOKIE_NAME = 'unisaas_tenant_id';
export const USER_COOKIE_NAME = 'unisaas_user_data';

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string;
  branchId?: string;
}

/**
 * Lee la sesión activa del usuario a partir de cookies HTTP seguras (httpOnly).
 * Garantiza que tokens JWT nunca se expongan en el almacenamiento local del navegador.
 */
export async function getServerSession(): Promise<{ token: string | null; user: UserSession | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
  const rawUser = cookieStore.get(USER_COOKIE_NAME)?.value;

  let user: UserSession | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }

  return { token, user };
}

/**
 * Establece cookies seguras tras autenticación exitosa.
 */
export async function setServerSession(token: string, user: UserSession, maxAgeSeconds = 3600) {
  const cookieStore = await cookies();

  // Cookie httpOnly con el access token (inaccesible desde JS del cliente)
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });

  cookieStore.set(TENANT_COOKIE_NAME, user.tenantId, {
    httpOnly: false, // Accesible para telemetría y UI multi-tenant
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });

  cookieStore.set(USER_COOKIE_NAME, JSON.stringify(user), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

/**
 * Elimina las cookies de sesión al hacer logout.
 */
export async function clearServerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(TENANT_COOKIE_NAME);
  cookieStore.delete(USER_COOKIE_NAME);
}

