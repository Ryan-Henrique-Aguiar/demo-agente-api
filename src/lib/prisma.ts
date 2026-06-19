import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// 1. Cria o pool do driver do PostgreSQL nativo do Node
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Instancia o adaptador oficial do Prisma para o Driver 'pg'
const adapter = new PrismaPg(pool);

// 3. Passa o adapter EXPLICITAMENTE para o construtor do PrismaClient
export const prisma = new PrismaClient({
  adapter: adapter, // Certifique-se de que está escrito exatamente assim
});