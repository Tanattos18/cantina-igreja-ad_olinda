"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { PAGAR_QUANDO } from "@/db/schema";
import { lerConfiguracao, pixConfigurado } from "@/lib/config";
import { normalizarTelefone } from "@/lib/dominio";
import { registrarPedido, vendaAberta } from "@/lib/vendas";

const Entrada = z.object({
  vendaId: z.number().int().positive(),
  nome: z.string().trim().min(2, "Informe seu nome.").max(80),
  telefone: z.string().trim().max(30),
  observacao: z.string().trim().max(300),
  pagarQuando: z.enum(PAGAR_QUANDO, { error: "Escolha como vai pagar." }),
  itens: z.array(z.object({ vendaItemId: z.number().int().positive(), quantidade: z.number() })).max(30),
});

export type ResultadoEnvio = { erro: string } | { codigo: string };

export async function fazerPedido(entrada: unknown): Promise<ResultadoEnvio> {
  const r = Entrada.safeParse(entrada);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;

  const telefone = normalizarTelefone(d.telefone);
  if (!telefone) return { erro: "Informe seu WhatsApp com DDD, ex.: (62) 99999-0000." };

  const db = await getDb();
  const venda = await vendaAberta(db);
  if (!venda || venda.id !== d.vendaId) return { erro: "Esta venda foi encerrada. Atualize a página." };
  if (d.pagarQuando === "pix_agora" && !pixConfigurado(await lerConfiguracao(db))) {
    return { erro: "O Pix pelo site não está disponível. Escolha pagar na retirada." };
  }

  const res = await registrarPedido(db, {
    vendaId: venda.id,
    origem: "site",
    clienteNome: d.nome,
    clienteTelefone: telefone,
    observacao: d.observacao || null,
    pagarQuando: d.pagarQuando,
    itens: d.itens,
  });
  return "erro" in res ? res : { codigo: res.codigo };
}
