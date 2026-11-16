import { fecharDb, getDb } from "../src/db";
import { cargaInicial } from "./seed";

/**
 * Roda antes do build na Vercel: cria/atualiza as tabelas no banco (Neon) e faz a carga inicial.
 * Sem DATABASE_URL não faz nada (o build segue, e o site avisa que falta o banco).
 */
async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log("DATABASE_URL não configurada: banco não preparado.");
    return;
  }
  const db = await getDb();
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Tabelas atualizadas.");
  await cargaInicial(db);
  await fecharDb();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Falha ao preparar o banco:", e);
    process.exit(1);
  });
