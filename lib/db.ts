import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let database: NeonQueryFunction<false, false> | null = null;

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Banco de dados ainda não configurado. Adicione DATABASE_URL na Vercel.");
  }
  if (!database) database = neon(connectionString);
  return database;
}
