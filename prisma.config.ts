import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Mantemos a url aqui APENAS para o comando de migração (Prisma Migrate) funcionar via CLI
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
  // ADICIONE ESTE BLOCO ABAIXO:
  client: {
    engineType: "client",
  },
});