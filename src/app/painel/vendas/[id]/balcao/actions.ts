"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { MEIOS_RECEBIMENTO } from "@/db/schema";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { registrarPedido } from "@/lib/vendas";

const Entrada = z.object({
  vendaId: z.number().int().positive(),
  nome: z.string().trim().max(80),
  meio: z.enum(MEIOS_RECEBIMENTO, { error: "Escolha como a pessoa pagou." }),
  itens: z.array(z.object({ vendaItemId: z.number().int().positive(), quantidade: z.number() })).max(30),
});

export type ResultadoBalcao = { erro: string } | { numero: number; total: number };

/** Venda feita na hora: já entra paga e entregue, e desconta das quantidades da venda. */
export async function venderNoBalcao(entrada: unknown): Promise<ResultadoBalcao> {
  const usuario = await exigirUsuario();
  const r = Entrada.safeParse(entrada);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const db = await getDb();
  const res = await registrarPedido(db, {
    vendaId: d.vendaId,
    origem: "balcao",
    clienteNome: d.nome || "Balcão",
    clienteTelefone: null,
    observacao: null,
    pagarQuando: "na_retirada",
    itens: d.itens,
    pagoCom: d.meio,
    entregue: true,
    usuarioId: usuario.uid,
  });
  if ("erro" in res) return res;
  await auditar(db, usuario.uid, "balcao", "pedido", res.id, { total: res.total, meio: d.meio });
  revalidatePath(`/painel/vendas/${d.vendaId}`, "layout");
  return { numero: res.numero, total: res.total };
}
