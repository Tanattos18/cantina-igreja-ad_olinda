"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { MEIOS_RECEBIMENTO, type MeioRecebimento } from "@/db/schema";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";

const P = schema.pedidos;

async function alterar(formData: FormData, acao: string, mudanca: Partial<typeof P.$inferInsert>, condicao = isNull(P.canceladoEm)) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  const db = await getDb();
  const [p] = await db.update(P).set(mudanca).where(and(eq(P.id, id), condicao)).returning({ vendaId: P.vendaId });
  if (!p) return;
  await auditar(db, usuario.uid, acao, "pedido", id, mudanca);
  revalidatePath(`/painel/vendas/${p.vendaId}`);
}

export async function marcarPago(formData: FormData) {
  const meio = String(formData.get("meio")) as MeioRecebimento;
  if (!MEIOS_RECEBIMENTO.includes(meio)) return;
  await alterar(formData, "pago", { pagoEm: new Date(), pagoCom: meio });
}

export async function desfazerPago(formData: FormData) {
  await alterar(formData, "desfazer_pago", { pagoEm: null, pagoCom: null });
}

export async function marcarEntregue(formData: FormData) {
  await alterar(formData, "entregue", { entregueEm: new Date() });
}

export async function desfazerEntregue(formData: FormData) {
  await alterar(formData, "desfazer_entregue", { entregueEm: null });
}

/** Cancelar devolve as unidades para a venda. Pedido já entregue não pode ser cancelado. */
export async function cancelarPedido(formData: FormData) {
  await alterar(formData, "cancelar", { canceladoEm: new Date() }, and(isNull(P.canceladoEm), isNull(P.entregueEm))!);
}
