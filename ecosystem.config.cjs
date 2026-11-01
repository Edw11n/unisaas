// ============================================================================
// ecosystem.config.cjs - PM2 PRODUCCIÓN (UniSaaS Monorepo)
// ============================================================================
// Orquesta los dos servicios definitivos del monorepo:
//   1. unisaas-api-gateway: Backend Monolítico Modular NestJS (Puerto 3000)
//   2. unisaas-web-pos: Frontend Web POS Next.js 15 (Puerto 3001)
// ============================================================================

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'unisaas-api-gateway',
      cwd: path.join(__dirname, 'apps', 'api-gateway'),
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '512M',
      watch: false,
    },
    {
      name: 'unisaas-web-pos',
      cwd: path.join(__dirname, 'apps', 'web-pos'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '512M',
      watch: false,
    },
  ],
};
