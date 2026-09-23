import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// `prisma generate` (contrairement à `migrate`/`studio`) ne se connecte jamais
// à la base : il lit uniquement le schéma. On tolère donc l'absence de
// DATABASE_URL dans ce seul cas (CI, `nx test` sur un checkout neuf) via une
// valeur de repli jamais utilisée pour une vraie connexion. Les commandes qui
// se connectent réellement (migrate, studio, db push...) continuent d'exiger
// DATABASE_URL et échouent explicitement si elle est absente.
const isGenerateOnly = process.argv.includes('generate');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: isGenerateOnly
      ? (process.env.DATABASE_URL ??
        'postgresql://placeholder:placeholder@localhost:5432/placeholder')
      : env('DATABASE_URL'),
  },
});
