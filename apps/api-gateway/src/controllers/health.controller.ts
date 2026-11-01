import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaClient } from '@unisaas/database';
import { RedisClientService } from '@unisaas/redis-client';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisService: RedisClientService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Sonda de disponibilidad y salud de infraestructura' })
  @ApiResponse({ status: 200, description: 'Servicios en línea' })
  @ApiResponse({ status: 503, description: 'Servicios degradados' })
  async checkHealth() {
    let dbStatus = 'healthy';
    let redisStatus = 'healthy';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'unhealthy';
    }

    try {
      const redisHealthy = await this.redisService.isHealthy();
      redisStatus = redisHealthy ? 'healthy' : 'unhealthy';
    } catch {
      redisStatus = 'unhealthy';
    }

    const overallStatus = dbStatus === 'healthy' ? (redisStatus === 'healthy' ? 'ok' : 'degraded') : 'down';

    return {
      status: overallStatus,
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}

