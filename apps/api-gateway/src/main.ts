import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // Ajuste de pool de conexiones para alta concurrencia
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public&connection_limit=50&pool_timeout=30';
  } else if (!process.env.DATABASE_URL.includes('connection_limit')) {
    process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connection_limit=50&pool_timeout=30`;
  }

  const app = await NestFactory.create(AppModule);

  // Prefijo global versionado
  app.setGlobalPrefix('api/v1');

  // Habilitar CORS para SPA web y POS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Configuración de Documentación OpenAPI / Swagger
  const config = new DocumentBuilder()
    .setTitle('UniSaaS Multi-Tenant Cloud ERP & POS')
    .setDescription(
      'API Gateway modular para la plataforma SaaS contable, POS, inventarios y cartera multi-inquilino con aislamiento RLS en PostgreSQL 16 y caché auxiliar Redis 7',
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Ingrese el Access Token JWT',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Exportación determinista de OpenAPI sin levantar puerto HTTP
  if (process.env.EXPORT_OPENAPI === 'true') {
    const fs = await import('fs');
    const path = await import('path');
    const outPath = process.env.OPENAPI_OUT_PATH
      ? path.resolve(process.env.OPENAPI_OUT_PATH)
      : path.resolve(process.cwd(), '../../docs/openapi.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf-8');
    console.log(`[OpenAPI] Especificación OpenAPI v3 exportada exitosamente en: ${outPath}`);
    await app.close();
    process.exit(0);
  }

  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`UniSaaS API Gateway ejecutándose en http://localhost:${port}/api/v1`);
  console.log(`Documentación OpenAPI disponible en http://localhost:${port}/api/v1/docs`);
}

bootstrap().catch((err) => {
  console.error('Fallo al inicializar UniSaaS API Gateway:', err);
  process.exit(1);
});

