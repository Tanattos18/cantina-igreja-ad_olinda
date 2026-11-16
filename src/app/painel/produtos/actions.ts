"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { lerForm, zValor, type EstadoAcao } from "@/lib/form";
import { gravarImagem } from "@/lib/imagens";
import { vendaAberta } from "@/lib/vendas";

const Produto = z.object({
  id: z.coerce.number().int().positive().optional(),
  nome: z.string().min(2, "informe o nome").max(80),
  descricao: z.string().max(200).optional(),
  categoria: z.string().max(40).optional(),
  emoji: z.string().max(16).optional(),
  preco: zValor,
});

export async function salvarProduto(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Produto);
  if (!dados) return { erro };
  const db = await getDb();
  // Foto: nova (data URL vinda do navegador), removida, ou sem mudança.
  const foto = String(formData.get("foto") ?? "");
  let imagemId: number | null | undefined;
  if (foto) {
    const r = await gravarImagem(db, foto);
    if (typeof r === "string") return { erro: r };
    imagemId = r;
  } else if (formData.get("fotoRemover")) {
    imagemId = null;
  }
  const valores = {
    nome: dados.nome,
    descricao: dados.descricao ?? null,
    categoria: dados.categoria ?? null,
    emoji: dados.emoji ?? null,
    preco: dados.preco,
    ...(imagemId !== undefined ? { imagemId } : {}),
  };
  if (dados.id) {
    await db.update(schema.produtos).set(valores).where(eq(schema.produtos.id, dados.id));
    await auditar(db, usuario.uid, "editar", "produto", dados.id, valores);
    revalidatePath("/", "layout");
    return { ok: "Produto salvo." };
  }
  const [p] = await db.insert(schema.produtos).values(valores).returning({ id: schema.produtos.id });
  await auditar(db, usuario.uid, "criar", "produto", p.id, valores);
  // Produto novo já entra na venda aberta (dá para tirar pela chave "À venda").
  const venda = await vendaAberta(db);
  if (venda) await db.insert(schema.vendaItens).values({ vendaId: venda.id, produtoId: p.id, preco: dados.preco }).onConflictDoNothing();
  revalidatePath("/", "layout");
  return { ok: venda ? `${dados.nome} cadastrado e já à venda na loja.` : `${dados.nome} cadastrado.` };
}

/** Tirar do cardápio é definitivo (some das próximas vendas) e também tira da venda aberta. */
export async function alternarProduto(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  const db = await getDb();
  await db.update(schema.produtos).set({ ativo }).where(eq(schema.produtos.id, id));
  if (!ativo) {
    const venda = await vendaAberta(db);
    if (venda) {
      await db
        .update(schema.vendaItens)
        .set({ ativo: false })
        .where(and(eq(schema.vendaItens.vendaId, venda.id), eq(schema.vendaItens.produtoId, id)));
    }
  }
  await auditar(db, usuario.uid, ativo ? "ativar" : "desativar", "produto", id);
  revalidatePath("/", "layout");
}

/** Chave "À venda": coloca o produto na venda aberta (preço do cardápio) ou tira da loja. */
export async function alternarNaVenda(formData: FormData) {
  const usuario = await exigirUsuario();
  const produtoId = Number(formData.get("produtoId"));
  const ligar = formData.get("ligar") === "1";
  const db = await getDb();
  const venda = await vendaAberta(db);
  const [produto] = await db.select().from(schema.produtos).where(eq(schema.produtos.id, produtoId));
  if (!venda || !produto) return;
  if (ligar) {
    await db
      .insert(schema.vendaItens)
      .values({ vendaId: venda.id, produtoId, preco: produto.preco })
      .onConflictDoUpdate({ target: [schema.vendaItens.vendaId, schema.vendaItens.produtoId], set: { ativo: true } });
  } else {
    await db
      .update(schema.vendaItens)
      .set({ ativo: false })
      .where(and(eq(schema.vendaItens.vendaId, venda.id), eq(schema.vendaItens.produtoId, produtoId)));
  }
  await auditar(db, usuario.uid, ligar ? "colocar_a_venda" : "tirar_da_venda", "venda", venda.id, { produto: produto.nome });
  revalidatePath("/", "layout");
}

const Quantidade = z.object({
  vendaItemId: z.coerce.number().int().positive(),
  limite: z.coerce.number({ error: "quantidade inválida" }).int("use um número inteiro").min(0, "não pode ser negativa").max(100000).optional(),
});

/** Quantas unidades a cantina tem do item. Vazio = sem limite. Ao chegar a zero, a loja mostra "Esgotado". */
export async function definirQuantidade(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Quantidade);
  if (!dados) return { erro: erro.replace(/^limite: /, "") };
  const db = await getDb();
  const [item] = await db
    .update(schema.vendaItens)
    .set({ limite: dados.limite ?? null })
    .where(eq(schema.vendaItens.id, dados.vendaItemId))
    .returning({ vendaId: schema.vendaItens.vendaId });
  if (!item) return { erro: "Item não encontrado." };
  await auditar(db, usuario.uid, "quantidade", "venda", item.vendaId, dados);
  revalidatePath("/", "layout");
  return { ok: dados.limite == null ? "Sem limite." : "Salvo." };
}
