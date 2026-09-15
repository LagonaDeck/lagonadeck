import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` (contrairement à `migrate`/`studio`) ne se connecte jamais
// à la base : il lit uniquement le schéma. On tolère donc l'absence de
// DATABASE_URL (CI, `nx test` sur un checkout neuf) via une valeur de repli,
// sans jamais l'utiliser pour une vraie connexion.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
