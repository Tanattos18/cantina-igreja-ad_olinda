import { getDb } from "@/db";
import { usuarioAutorizado } from "@/lib/auth";
import { ROTULO_ESTADO, ROTULO_MEIO, ROTULO_PAGAR, estadoPedido, telefoneBR } from "@/lib/dominio";
import { pedidosDaVenda, vendaPorId } from "@/lib/vendas";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const valor = (v: number) => v.toFixed(2).replace(".", ",");

/** Campo de CSV: aspas quando preciso e sem fórmulas (texto começando com =, +, - ou @). */
function campo(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Planilha dos pedidos (abre no Excel e no Google Planilhas) para a prestação de contas. */
export async function GET(_: Request, { params }: RouteContext<"/painel/vendas/[id]/planilha">) {
  if (!(await usuarioAutorizado())) return new Response("Faça login.", { status: 401 });
  const id = Number((await params).id);
  const db = await getDb();
  const venda = Number.isInteger(id) ? await vendaPorId(db, id) : undefined;
  if (!venda) return new Response("Venda não encontrada.", { status: 404 });
  const pedidos = (await pedidosDaVenda(db, venda.id)).sort((a, b) => a.numero - b.numero);

  const linhas = [
    ["Nº", "Data", "Cliente", "WhatsApp", "Origem", "Pagamento escolhido", "Itens", "Total (R$)", "Situação", "Recebido em", "Observação"],
    ...pedidos.map((p) => [
      p.numero,
      fmtData.format(p.criadoEm),
      p.clienteNome,
      telefoneBR(p.clienteTelefone),
      p.origem === "balcao" ? "Balcão" : "Site",
      p.origem === "balcao" ? "Na hora" : ROTULO_PAGAR[p.pagarQuando],
      p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", "),
      valor(p.total),
      ROTULO_ESTADO[estadoPedido(p)],
      p.pagoCom && !p.canceladoEm ? ROTULO_MEIO[p.pagoCom] : "",
      p.observacao,
    ]),
  ];
  // BOM + ponto e vírgula: o Excel em português abre com acentos e colunas certas.
  const csv = "﻿" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");
  const nome = `cantina-${venda.dataRetirada}-pedidos.csv`;
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
  });
}
