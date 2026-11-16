"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth";
import { lerForm, zSenha, type EstadoAcao } from "@/lib/form";

const NovoUsuario = z.object({
  nome: z.string().min(2, "informe o nome").max(80),
  email: z.email("e-mail inválido"),
  senha: zSenha,
  perfil: z.enum(["admin", "voluntario"]),
});

export async function criarUsuario(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, NovoUsuario);
  if (!dados) return { erro };
  const db = await getDb();
  const [novo] = await db
    .insert(schema.usuarios)
    .values({ nome: dados.nome, email: dados.email.toLowerCase(), perfil: dados.perfil, senhaHash: await bcrypt.hash(dados.senha, 10), trocarSenha: true })
    .onConflictDoNothing()
    .returning();
  if (!novo) return { erro: "Já existe um usuário com esse e-mail." };
  await auditar(db, admin.uid, "criar", "usuario", novo.id, { nome: dados.nome, email: dados.email, perfil: dados.perfil });
  revalidatePath("/painel/usuarios");
  return { ok: "Acesso criado. No primeiro login a pessoa troca a senha provisória." };
}

/** Ativa/desativa e muda o perfil de outra pessoa da equipe (nunca o próprio, para não se trancar fora). */
export async function alterarUsuario(formData: FormData) {
  const admin = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (id === admin.uid) return;
  const mudanca: { ativo?: boolean; perfil?: "admin" | "voluntario" } = {};
  if (formData.has("ativo")) mudanca.ativo = formData.get("ativo") === "true";
  const perfil = formData.get("perfil");
  if (perfil === "admin" || perfil === "voluntario") mudanca.perfil = perfil;
  if (!Object.keys(mudanca).length) return;
  const db = await getDb();
  await db.update(schema.usuarios).set(mudanca).where(eq(schema.usuarios.id, id));
  await auditar(db, admin.uid, "editar", "usuario", id, mudanca);
  revalidatePath("/painel/usuarios");
}

const NovaSenha = z.object({ id: z.coerce.number().int().positive(), senha: zSenha });

/** Senha provisória para quem esqueceu: a pessoa troca no próximo acesso. */
export async function redefinirSenha(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, NovaSenha);
  if (!dados) return { erro };
  const db = await getDb();
  const r = await db
    .update(schema.usuarios)
    .set({ senhaHash: await bcrypt.hash(dados.senha, 10), trocarSenha: true, ativo: true })
    .where(eq(schema.usuarios.id, dados.id))
    .returning({ id: schema.usuarios.id });
  if (!r.length) return { erro: "Usuário não encontrado." };
  await auditar(db, admin.uid, "redefinir_senha", "usuario", dados.id);
  return { ok: "Senha provisória definida. Passe para a pessoa: ela troca no próximo acesso." };
}

