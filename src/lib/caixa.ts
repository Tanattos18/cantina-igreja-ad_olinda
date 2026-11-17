import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { Configuracao } from "./config";

export type Caixa = { nome: string | null; whatsapp: string | null };

/**
 * Para onde vão os comprovantes de Pix de uma venda: o WhatsApp de quem está no caixa
 * (quem abriu a cantina, ou escolhido em Editar venda). Sem número cadastrado, usa o
 * WhatsApp reserva de Configurações.
 */
export async function caixaDaVenda(db: Pick<DB, "select">, venda: { caixaUsuarioId: number | null }, config: Configuracao): Promise<Caixa> {
  if (venda.caixaUsuarioId) {
    const [u] = await db
      .select({ nome: schema.usuarios.nome, whatsapp: schema.usuarios.whatsapp, ativo: schema.usuarios.ativo })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, venda.caixaUsuarioId));
    if (u?.ativo && u.whatsapp) return { nome: u.nome, whatsapp: u.whatsapp };
  }
  return { nome: null, whatsapp: config.whatsapp };
}
