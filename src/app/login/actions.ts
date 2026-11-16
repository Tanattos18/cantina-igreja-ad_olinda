"use server";

import bcrypt from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { encerrarSessao, iniciarSessao } from "@/lib/auth";
import { lerForm, zSenha, type EstadoAcao } from "@/lib/form";
import { JANELA_MINUTOS, loginBloqueado, registrarTentativa } from "@/lib/login";

const Login = z.object({ email: z.email("e-mail inválido"), senha: z.string().min(1) });

// Hash qualquer, para o tempo de resposta não revelar se o e-mail existe.
const HASH_FICTICIO = "$2b$10$vV8.JfC6eaxZ488kgtakM.VPHgg2qXtvJ40dL/Zckec0tKROkxfTe";

async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "desconhecido";
}

export async function entrar(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { dados } = lerForm(formData, Login);
  if (!dados) return { erro: "Informe e-mail e senha." };

  const email = dados.email.toLowerCase();
  const ip = await ipDaRequisicao();
  const db = await getDb();
  if (await loginBloqueado(db, email, ip)) {
    return { erro: `Muitas tentativas sem sucesso. Aguarde ${JANELA_MINUTOS} minutos e tente de novo.` };
  }

  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, email));
  const senhaOk = await bcrypt.compare(dados.senha, u?.senhaHash ?? HASH_FICTICIO);
  if (!u || !u.ativo || !senhaOk) {
    await registrarTentativa(db, email, ip, false);
    return { erro: "E-mail ou senha incorretos." };
  }

  await registrarTentativa(db, email, ip, true);
  await iniciarSessao({ uid: u.id, nome: u.nome, perfil: u.perfil });
  await auditar(db, u.id, "login", "usuario", u.id, { ip });
  redirect(u.trocarSenha ? "/trocar-senha" : "/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}

const PrimeiroAdmin = z.object({
  nome: z.string().min(2, "informe seu nome").max(80),
  email: z.email("e-mail inválido"),
  senha: zSenha,
});

/**
 * Primeiro acesso de um sistema recém-publicado: sem nenhum usuário cadastrado, quem abre o painel
 * cria o administrador. Depois disso esta ação não faz mais nada.
 */
export async function criarPrimeiroAdmin(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { dados, erro } = lerForm(formData, PrimeiroAdmin);
  if (!dados) return { erro };
  const db = await getDb();
  const criado = await db.transaction(async (tx) => {
    // Trava a tabela: dois cadastros ao mesmo tempo não criam dois administradores.
    await tx.execute(sql`lock table usuarios in exclusive mode`);
    const [{ n }] = await tx.select({ n: count() }).from(schema.usuarios);
    if (n > 0) return null;
    const [u] = await tx
      .insert(schema.usuarios)
      .values({ nome: dados.nome, email: dados.email.toLowerCase(), senhaHash: await bcrypt.hash(dados.senha, 10), perfil: "admin" })
      .returning();
    await auditar(tx, u.id, "primeiro_admin", "usuario", u.id);
    return u;
  });
  if (!criado) return { erro: "O administrador já foi criado. Entre com e-mail e senha." };
  await iniciarSessao({ uid: criado.id, nome: criado.nome, perfil: "admin" });
  redirect("/painel/configuracoes");
}
