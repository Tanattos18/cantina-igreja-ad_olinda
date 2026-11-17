"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth";
import { lerConfiguracao } from "@/lib/config";
import { normalizarTelefone } from "@/lib/dominio";
import { mensagemConvite, novoConvite, senhaInutilizavel } from "@/lib/convite";
import { lerForm, zSenha, type EstadoAcao } from "@/lib/form";

const zPerfil = z.enum(["admin", "voluntario"]);

const NovoUsuario = z.object({
  nome: z.string().min(2, "informe o nome").max(80),
  email: z.email("e-mail inválido"),
  perfil: zPerfil,
});

/** Cadastra sem senha: devolve o link para a própria pessoa criar a dela. */
export async function criarUsuario(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, NovoUsuario);
  if (!dados) return { erro };
  const db = await getDb();
  const convite = novoConvite();
  const [novo] = await db
    .insert(schema.usuarios)
    .values({
      nome: dados.nome,
      email: dados.email.toLowerCase(),
      perfil: dados.perfil,
      senhaHash: await bcrypt.hash(senhaInutilizavel(), 10),
      conviteHash: convite.conviteHash,
      conviteExpiraEm: convite.conviteExpiraEm,
    })
    .onConflictDoNothing()
    .returning();
  if (!novo) return { erro: "Já existe alguém com esse e-mail." };
  await auditar(db, admin.uid, "criar", "usuario", novo.id, { nome: dados.nome, email: dados.email, perfil: dados.perfil });
  revalidatePath("/painel/usuarios");
  const config = await lerConfiguracao(db);
  return {
    ok: `${dados.nome} cadastrado(a). Mande o link abaixo para a pessoa criar a senha.`,
    link: convite.link,
    mensagem: mensagemConvite(dados.nome, config.nome),
  };
}

const Edicao = z.object({
  id: z.coerce.number().int().positive(),
  nome: z.string().min(2, "informe o nome").max(80),
  email: z.email("e-mail inválido"),
  perfil: zPerfil.optional(),
  whatsapp: z.string().max(30).optional(),
});

/** Nome, e-mail e perfil. O administrador não muda o próprio perfil (para não se trancar fora). */
export async function editarUsuario(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, Edicao);
  if (!dados) return { erro };
  const email = dados.email.toLowerCase();
  const db = await getDb();
  const [repetido] = await db
    .select({ id: schema.usuarios.id })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.email, email), ne(schema.usuarios.id, dados.id)));
  if (repetido) return { erro: "Esse e-mail já é de outra pessoa da equipe." };
  const whatsapp = dados.whatsapp ? normalizarTelefone(dados.whatsapp) : null;
  if (dados.whatsapp && !whatsapp) return { erro: "WhatsApp inválido. Use DDD + número, ex.: (62) 99999-0000." };
  const mudanca = { nome: dados.nome, email, whatsapp, ...(dados.perfil && dados.id !== admin.uid ? { perfil: dados.perfil } : {}) };
  const r = await db.update(schema.usuarios).set(mudanca).where(eq(schema.usuarios.id, dados.id)).returning({ id: schema.usuarios.id });
  if (!r.length) return { erro: "Pessoa não encontrada." };
  await auditar(db, admin.uid, "editar", "usuario", dados.id, mudanca);
  revalidatePath("/painel", "layout");
  return { ok: "Salvo." };
}

/** Ativa ou desativa o acesso de outra pessoa (nunca o próprio). */
export async function alternarAcesso(formData: FormData) {
  const admin = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id === admin.uid) return;
  const ativo = formData.get("ativo") === "true";
  const db = await getDb();
  await db.update(schema.usuarios).set({ ativo }).where(eq(schema.usuarios.id, id));
  await auditar(db, admin.uid, ativo ? "reativar" : "desativar", "usuario", id);
  revalidatePath("/painel/usuarios");
}

/**
 * Novo link para a pessoa criar (ou trocar, se esqueceu) a senha. A senha antiga continua valendo
 * até ela usar o link; links anteriores deixam de funcionar.
 */
export async function gerarConvite(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { erro: "Pessoa não encontrada." };
  const db = await getDb();
  const convite = novoConvite();
  const [u] = await db
    .update(schema.usuarios)
    .set({ conviteHash: convite.conviteHash, conviteExpiraEm: convite.conviteExpiraEm, ativo: true })
    .where(eq(schema.usuarios.id, id))
    .returning({ nome: schema.usuarios.nome });
  if (!u) return { erro: "Pessoa não encontrada." };
  await auditar(db, admin.uid, "gerar_convite", "usuario", id);
  revalidatePath("/painel/usuarios");
  const config = await lerConfiguracao(db);
  return { ok: "Link gerado.", link: convite.link, mensagem: mensagemConvite(u.nome, config.nome) };
}

const SenhaProvisoria = z.object({ id: z.coerce.number().int().positive(), senha: zSenha });

/** Para quem não usa WhatsApp: senha provisória que a pessoa troca no próximo acesso. */
export async function definirSenhaProvisoria(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, SenhaProvisoria);
  if (!dados) return { erro };
  const db = await getDb();
  const r = await db
    .update(schema.usuarios)
    .set({ senhaHash: await bcrypt.hash(dados.senha, 10), trocarSenha: true, ativo: true, conviteHash: null, conviteExpiraEm: null })
    .where(eq(schema.usuarios.id, dados.id))
    .returning({ id: schema.usuarios.id });
  if (!r.length) return { erro: "Pessoa não encontrada." };
  await auditar(db, admin.uid, "senha_provisoria", "usuario", dados.id);
  return { ok: "Senha provisória definida. A pessoa cria a dela no próximo acesso." };
}
