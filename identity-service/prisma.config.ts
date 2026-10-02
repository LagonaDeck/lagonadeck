import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // `prisma generate` ne se connecte pas : l'URL n'est exigée que par migrate/studio.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
