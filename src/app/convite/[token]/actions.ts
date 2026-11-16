"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { iniciarSessao } from "@/lib/auth";
import { hashConvite } from "@/lib/convite";
import { zSenha, type EstadoAcao } from "@/lib/form";

/** A pessoa cria a própria senha pelo link do convite e já entra no painel. */
export async function criarSenhaPeloConvite(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const token = String(formData.get("token") ?? "");
  const senha = String(formData.get("senha") ?? "");
  if (senha !== formData.get("confirmacao")) return { erro: "As duas senhas não são iguais." };
  const valida = zSenha.safeParse(senha);
  if (!valida.success) return { erro: `A ${valida.error.issues[0].message}.` };

  const db = await getDb();
  const U = schema.usuarios;
  const [u] = await db
    .update(U)
    .set({ senhaHash: await bcrypt.hash(senha, 10), trocarSenha: false, conviteHash: null, conviteExpiraEm: null })
    // Só um uso: o hash some na mesma atualização que grava a senha.
    .where(and(eq(U.conviteHash, hashConvite(token)), gt(U.conviteExpiraEm, new Date()), eq(U.ativo, true)))
    .returning({ id: U.id, nome: U.nome, perfil: U.perfil });
  if (!u) return { erro: "Este link não vale mais. Peça um novo ao administrador da cantina." };
  await auditar(db, u.id, "criar_senha_convite", "usuario", u.id);
  await iniciarSessao({ uid: u.id, nome: u.nome, perfil: u.perfil });
  redirect("/painel");
}
