"use server";

import { and, count, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { lerForm, zData, zId, zValor, type EstadoAcao } from "@/lib/form";
import { deDataHoraLocal, proximoDomingo } from "@/lib/formato";

const DadosVenda = z.object({
  titulo: z.string().min(3, "informe um título").max(80),
  dataRetirada: zData,
  retirada: z.string().max(150).optional(),
  encerraEm: z.string().optional(),
});

function lerVenda(formData: FormData) {
  const { dados, erro } = lerForm(formData, DadosVenda);
  if (!dados) return { erro };
  const encerraEm = dados.encerraEm ? deDataHoraLocal(dados.encerraEm) : null;
  if (dados.encerraEm && !encerraEm) return { erro: "Horário de encerramento inválido." };
  return { valores: { titulo: dados.titulo, dataRetirada: dados.dataRetirada, retirada: dados.retirada ?? null, encerraEm } };
}

/** Nova venda já com os produtos ativos do cardápio, no preço padrão e sem limite. */
export async function criarVenda(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const r = lerVenda(formData);
  if (!r.valores) return { erro: r.erro };
  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    const [v] = await tx.insert(schema.vendas).values(r.valores).returning({ id: schema.vendas.id });
    const produtos = await tx.select().from(schema.produtos).where(eq(schema.produtos.ativo, true));
    if (produtos.length) {
      await tx.insert(schema.vendaItens).values(produtos.map((p) => ({ vendaId: v.id, produtoId: p.id, preco: p.preco })));
    }
    await auditar(tx, usuario.uid, "criar", "venda", v.id, r.valores);
    return v.id;
  });
  redirect(`/painel/vendas/${id}/editar`);
}

/**
 * Um clique: deixa a loja recebendo pedidos. Abre a venda em rascunho mais recente; se não houver,
 * cria a venda do próximo domingo com todo o cardápio (preço padrão, sem limite) e já abre.
 * Preços, quantidades e horário ficam para ajustar depois em "Editar venda".
 */
export async function abrirCantina() {
  const usuario = await exigirUsuario();
  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    const [aberta] = await tx.select({ id: schema.vendas.id }).from(schema.vendas).where(eq(schema.vendas.situacao, "aberta")).limit(1);
    if (aberta) return aberta.id;
    let [venda] = await tx
      .select({ id: schema.vendas.id })
      .from(schema.vendas)
      .where(eq(schema.vendas.situacao, "rascunho"))
      .orderBy(desc(schema.vendas.id))
      .limit(1);
    if (!venda) {
      [venda] = await tx
        .insert(schema.vendas)
        .values({ titulo: "Domingo é dia de cantina!", dataRetirada: proximoDomingo(), retirada: "na cantina, após o culto" })
        .returning({ id: schema.vendas.id });
      const produtos = await tx.select().from(schema.produtos).where(eq(schema.produtos.ativo, true));
      if (produtos.length) {
        await tx.insert(schema.vendaItens).values(produtos.map((p) => ({ vendaId: venda.id, produtoId: p.id, preco: p.preco })));
      }
    }
    await tx.update(schema.vendas).set({ situacao: "aberta" }).where(eq(schema.vendas.id, venda.id));
    await auditar(tx, usuario.uid, "abrir_cantina", "venda", venda.id);
    return venda.id;
  });
  revalidatePath("/", "layout");
  redirect(`/painel/vendas/${id}`);
}

export async function salvarVenda(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const r = lerVenda(formData);
  if (!r.valores) return { erro: r.erro };
  const db = await getDb();
  await db.update(schema.vendas).set(r.valores).where(eq(schema.vendas.id, id));
  await auditar(db, usuario.uid, "editar", "venda", id, r.valores);
  revalidatePath(`/painel/vendas/${id}`, "layout");
  return { ok: "Venda salva." };
}

/**
 * Abrir publica a venda no link da loja. Só uma fica aberta por vez: abrir outra encerra a anterior.
 */
export async function mudarSituacao(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const para = String(formData.get("situacao"));
  if (para !== "aberta" && para !== "encerrada" && para !== "rascunho") return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (para === "aberta") {
      await tx.update(schema.vendas).set({ situacao: "encerrada" }).where(and(eq(schema.vendas.situacao, "aberta"), ne(schema.vendas.id, id)));
    }
    await tx.update(schema.vendas).set({ situacao: para }).where(eq(schema.vendas.id, id));
    await auditar(tx, usuario.uid, "situacao", "venda", id, { para });
  });
  revalidatePath("/", "layout");
}

const NovoItem = z.object({ vendaId: zId, produtoId: zId });

export async function adicionarItem(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, NovoItem);
  if (!dados) return { erro };
  const db = await getDb();
  const [p] = await db.select().from(schema.produtos).where(eq(schema.produtos.id, dados.produtoId));
  if (!p) return { erro: "Produto não encontrado." };
  const [novo] = await db
    .insert(schema.vendaItens)
    .values({ vendaId: dados.vendaId, produtoId: p.id, preco: p.preco })
    .onConflictDoUpdate({ target: [schema.vendaItens.vendaId, schema.vendaItens.produtoId], set: { ativo: true } })
    .returning({ id: schema.vendaItens.id });
  await auditar(db, usuario.uid, "adicionar_item", "venda", dados.vendaId, { item: novo.id, produto: p.nome });
  revalidatePath(`/painel/vendas/${dados.vendaId}`, "layout");
  return { ok: `${p.nome} adicionado.` };
}

const DadosItem = z.object({ id: zId, preco: zValor, limite: z.coerce.number().int().min(0).max(100000).optional() });

export async function salvarItem(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, DadosItem);
  if (!dados) return { erro: erro.replace(/^limite:/, "Quantidade produzida:") };
  const db = await getDb();
  const [item] = await db
    .update(schema.vendaItens)
    .set({ preco: dados.preco, limite: dados.limite ?? null })
    .where(eq(schema.vendaItens.id, dados.id))
    .returning({ vendaId: schema.vendaItens.vendaId });
  if (!item) return { erro: "Item não encontrado." };
  await auditar(db, usuario.uid, "editar_item", "venda", item.vendaId, dados);
  revalidatePath(`/painel/vendas/${item.vendaId}`, "layout");
  return { ok: "Salvo." };
}

/** Item sem pedidos sai da venda; com pedidos, só deixa de aparecer na loja (o histórico fica). */
export async function removerItem(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const db = await getDb();
  const [item] = await db.select().from(schema.vendaItens).where(eq(schema.vendaItens.id, id));
  if (!item) return;
  const [{ n }] = await db.select({ n: count() }).from(schema.pedidoItens).where(eq(schema.pedidoItens.vendaItemId, id));
  if (n > 0) await db.update(schema.vendaItens).set({ ativo: false }).where(eq(schema.vendaItens.id, id));
  else await db.delete(schema.vendaItens).where(eq(schema.vendaItens.id, id));
  await auditar(db, usuario.uid, "remover_item", "venda", item.vendaId, { item: id });
  revalidatePath(`/painel/vendas/${item.vendaId}`, "layout");
}

export async function reativarItem(formData: FormData) {
  await exigirUsuario();
  const id = Number(formData.get("id"));
  const db = await getDb();
  const [item] = await db.update(schema.vendaItens).set({ ativo: true }).where(eq(schema.vendaItens.id, id)).returning({ vendaId: schema.vendaItens.vendaId });
  if (item) revalidatePath(`/painel/vendas/${item.vendaId}`, "layout");
}
