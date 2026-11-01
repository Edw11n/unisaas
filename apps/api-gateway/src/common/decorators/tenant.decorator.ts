import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Inyecta el tenantId autenticado y validado criptográficamente.
 *
 * Innegociable de Seguridad:
 * El tenantId se extrae exclusivamente del contexto validado por JwtAuthGuard.
 * Se prohíbe confiar ciegamente en parámetros o headers no verificados enviados por el cliente.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = request.tenantId || (request.user && request.user.tenantId);

    if (!tenantId) {
      throw new UnauthorizedException('Contexto de inquilino (tenantId) no disponible en la sesión');
    }

    return tenantId;
  },
);

