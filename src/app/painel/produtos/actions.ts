"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { lerForm, zValor, type EstadoAcao } from "@/lib/form";
import { gravarImagem } from "@/lib/imagens";

const Produto = z.object({
  id: z.coerce.number().int().positive().optional(),
  nome: z.string().min(2, "informe o nome").max(80),
  descricao: z.string().max(200).optional(),
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
    emoji: dados.emoji ?? null,
    preco: dados.preco,
    ...(imagemId !== undefined ? { imagemId } : {}),
  };
  if (dados.id) {
    await db.update(schema.produtos).set(valores).where(eq(schema.produtos.id, dados.id));
    await auditar(db, usuario.uid, "editar", "produto", dados.id, valores);
  } else {
    const [p] = await db.insert(schema.produtos).values(valores).returning({ id: schema.produtos.id });
    await auditar(db, usuario.uid, "criar", "produto", p.id, valores);
  }
  revalidatePath("/painel/produtos");
  return { ok: dados.id ? "Produto salvo." : `${dados.nome} cadastrado. Para vender, adicione na venda em Editar venda.` };
}

export async function alternarProduto(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  const db = await getDb();
  await db.update(schema.produtos).set({ ativo }).where(eq(schema.produtos.id, id));
  await auditar(db, usuario.uid, ativo ? "ativar" : "desativar", "produto", id);
  revalidatePath("/painel/produtos");
}
