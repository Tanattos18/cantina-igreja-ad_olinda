import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";

/** Teto depois da redução no navegador (uma foto de 800px fica em ~100 KB). */
const MAX_BYTES = 1_500_000;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function urlImagem(id: number | null | undefined): string | null {
  return id ? `/imagens/${id}` : null;
}

/** Grava a imagem enviada pelo painel (data URL). Devolve o id, ou uma mensagem de erro. */
export async function gravarImagem(db: Pick<DB, "insert">, dataUrl: string): Promise<number | string> {
  const m = DATA_URL.exec(dataUrl);
  if (!m) return "Imagem inválida. Use JPG, PNG ou WebP.";
  if ((m[2].length * 3) / 4 > MAX_BYTES) return "Imagem grande demais.";
  const [img] = await db.insert(schema.imagens).values({ tipo: m[1], dados: m[2] }).returning({ id: schema.imagens.id });
  return img.id;
}

export async function lerImagem(db: Pick<DB, "select">, id: number) {
  const [img] = await db.select().from(schema.imagens).where(eq(schema.imagens.id, id));
  return img;
}
