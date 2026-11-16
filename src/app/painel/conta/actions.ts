"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirLogin, exigirUsuario } from "@/lib/auth";
import { lerForm, zSenha, type EstadoAcao } from "@/lib/form";

const TrocaSenha = z.object({ atual: z.string().min(1), nova: zSenha });

export async function trocarSenha(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  // exigirLogin: precisa funcionar também com a senha provisória pendente de troca.
  const usuario = await exigirLogin();
  const { dados, erro } = lerForm(formData, TrocaSenha);
  if (!dados) return { erro };
  if (formData.has("confirmacao") && formData.get("confirmacao") !== dados.nova) return { erro: "As duas senhas novas não são iguais." };
  const db = await getDb();
  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, usuario.uid));
  if (!u || !(await bcrypt.compare(dados.atual, u.senhaHash))) return { erro: "Senha atual incorreta." };
  if (dados.atual === dados.nova) return { erro: "A nova senha precisa ser diferente da atual." };
  await db
    .update(schema.usuarios)
    .set({ senhaHash: await bcrypt.hash(dados.nova, 10), trocarSenha: false, conviteHash: null, conviteExpiraEm: null })
    .where(eq(schema.usuarios.id, u.id));
  await auditar(db, u.id, "trocar_senha", "usuario", u.id);
  return { ok: "Senha alterada." };
}

const MeuNome = z.object({ nome: z.string().min(2, "informe seu nome").max(80) });

export async function salvarMeuNome(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, MeuNome);
  if (!dados) return { erro };
  const db = await getDb();
  await db.update(schema.usuarios).set({ nome: dados.nome }).where(eq(schema.usuarios.id, usuario.uid));
  await auditar(db, usuario.uid, "editar_nome", "usuario", usuario.uid, { nome: dados.nome });
  revalidatePath("/painel", "layout");
  return { ok: "Nome salvo." };
}
