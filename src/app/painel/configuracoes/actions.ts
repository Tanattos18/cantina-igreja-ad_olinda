"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { TIPOS_CHAVE_PIX } from "@/db/schema";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth";
import { normalizarTelefone } from "@/lib/dominio";
import { lerForm, type EstadoAcao } from "@/lib/form";
import { gravarImagem } from "@/lib/imagens";
import { normalizarChave } from "@/lib/pix";

const Config = z.object({
  nome: z.string().min(2, "informe o nome da cantina").max(60),
  igreja: z.string().max(100).optional(),
  mensagem: z.string().max(120).optional(),
  endereco: z.string().max(200).optional(),
  cultos: z.string().max(120).optional(),
  instagram: z.string().max(60).optional(),
  whatsapp: z.string().max(30).optional(),
  pixTipo: z.enum(TIPOS_CHAVE_PIX).optional(),
  pixChave: z.string().max(100).optional(),
  pixNome: z.string().max(60).optional(),
  pixCidade: z.string().max(40).optional(),
});

export async function salvarConfiguracao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, Config);
  if (!dados) return { erro };

  const whatsapp = dados.whatsapp ? normalizarTelefone(dados.whatsapp) : null;
  if (dados.whatsapp && !whatsapp) return { erro: "WhatsApp inválido. Use DDD + número, ex.: (62) 99999-0000." };

  let pixChave: string | null = null;
  if (dados.pixChave) {
    if (!dados.pixTipo) return { erro: "Escolha o tipo da chave Pix." };
    pixChave = normalizarChave(dados.pixTipo, dados.pixChave);
    if (!pixChave) return { erro: "A chave Pix não confere com o tipo escolhido." };
    if (!dados.pixNome || !dados.pixCidade) return { erro: "Informe o nome e a cidade de quem recebe o Pix." };
  }

  const db = await getDb();
  const logo = String(formData.get("logo") ?? "");
  let logoId: number | null | undefined;
  if (logo) {
    const r = await gravarImagem(db, logo);
    if (typeof r === "string") return { erro: `Logo: ${r}` };
    logoId = r;
  } else if (formData.get("logoRemover")) {
    logoId = null;
  }

  const valores = {
    ...(logoId !== undefined ? { logoId } : {}),
    nome: dados.nome,
    igreja: dados.igreja ?? null,
    mensagem: dados.mensagem ?? null,
    endereco: dados.endereco ?? null,
    cultos: dados.cultos ?? null,
    instagram: dados.instagram?.replace(/^@/, "").replace(/[^\w.]/g, "") || null,
    whatsapp,
    pixTipo: pixChave ? dados.pixTipo! : null,
    pixChave,
    pixNome: pixChave ? dados.pixNome! : null,
    pixCidade: pixChave ? dados.pixCidade! : null,
  };
  await db.insert(schema.configuracao).values({ id: 1, ...valores }).onConflictDoUpdate({ target: schema.configuracao.id, set: valores });
  await auditar(db, admin.uid, "editar", "configuracao", 1, valores);
  revalidatePath("/", "layout");
  return { ok: "Configurações salvas." };
}
