import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { urlDoSite } from "@/lib/config";
import { restante } from "@/lib/dominio";
import { dataExtenso, dataHoraBR, moeda } from "@/lib/formato";
import { aceitaPedidosNoSite, itensDaVenda, pedidosDaVenda, resumir, vendaPorId } from "@/lib/vendas";
import { AutoAtualizar } from "@/components/auto-atualizar";
import { Cabecalho, Indicador } from "@/components/ui";
import { CompartilharLink } from "./compartilhar";
import { ListaPedidos } from "./lista-pedidos";

export const metadata = { title: "Pedidos — Painel" };

const SELO = {
  rascunho: "bg-stone-200 text-stone-700",
  aberta: "bg-green-100 text-green-800",
  encerrada: "bg-marinho-claro text-marinho",
} as const;

export default async function VendaPage({ params }: PageProps<"/painel/vendas/[id]">) {
  await exigirUsuario();
  const id = Number((await params).id);
  const db = await getDb();
  const venda = Number.isInteger(id) ? await vendaPorId(db, id) : undefined;
  if (!venda) notFound();
  const [itens, pedidos] = await Promise.all([itensDaVenda(db, venda.id), pedidosDaVenda(db, venda.id)]);
  const r = resumir(pedidos);

  // Valor vendido por item (pedidos não cancelados).
  const valorPorItem = new Map<number, number>();
  for (const p of pedidos) if (!p.canceladoEm) for (const i of p.itens) valorPorItem.set(i.vendaItemId, (valorPorItem.get(i.vendaItemId) ?? 0) + i.total);

  return (
    <div className="max-w-5xl">
      {venda.situacao === "aberta" && <AutoAtualizar segundos={20} />}
      <Cabecalho
        titulo={venda.titulo}
        descricao={
          <>
            <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${SELO[venda.situacao]}`}>
              {venda.situacao === "aberta" ? (aceitaPedidosNoSite(venda) ? "Aberta" : "Site encerrado · balcão aberto") : venda.situacao === "rascunho" ? "Rascunho" : "Encerrada"}
            </span>
            Retirada {dataExtenso(venda.dataRetirada)}
            {venda.encerraEm && <> · pedidos pelo site até {dataHoraBR(venda.encerraEm)}</>}
          </>
        }
        acoes={
          <>
            {venda.situacao === "aberta" && <Link href={`/painel/vendas/${venda.id}/balcao`} className="botao">+ Venda no balcão</Link>}
            <Link href={`/painel/vendas/${venda.id}/editar`} className="botao-sec">Editar venda</Link>
            <a href={`/painel/vendas/${venda.id}/planilha`} className="botao-sec">Baixar planilha</a>
          </>
        }
      />

      {venda.situacao === "aberta" && <CompartilharLink url={urlDoSite()} titulo={venda.titulo} data={dataExtenso(venda.dataRetirada)} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador destaque rotulo="Total vendido" valor={moeda(r.vendido)} detalhe={`${r.pedidos} ${r.pedidos === 1 ? "pedido" : "pedidos"}`} />
        <Indicador rotulo="Já recebido" valor={moeda(r.recebido)} detalhe={`Pix ${moeda(r.recebidoPor.pix)} · Dinheiro ${moeda(r.recebidoPor.dinheiro)}${r.recebidoPor.cartao ? ` · Cartão ${moeda(r.recebidoPor.cartao)}` : ""}`} />
        <Indicador rotulo="A receber" valor={moeda(r.aReceber)} detalhe="Pagam na retirada ou Pix a conferir" />
        <Indicador rotulo="Entregues" valor={`${r.entregues} de ${r.pedidos}`} detalhe={`${r.aguardandoRetirada} aguardando retirada`} />
      </div>

      <section className="cartao mt-6 overflow-x-auto p-0">
        <h2 className="px-5 pt-4 font-titulos text-xl font-bold text-marinho">O que separar</h2>
        <table className="tabela mt-2">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Pedidos</th>
              <th className="text-right">Produzido</th>
              <th className="text-right">Restam</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const resta = restante(i.limite, i.reservado);
              return (
                <tr key={i.id} className={i.ativo ? "" : "text-stone-400"}>
                  <td className="font-semibold">{i.emoji} {i.nome}</td>
                  <td className="text-right font-bold">{i.reservado}</td>
                  <td className="text-right">{i.limite ?? "—"}</td>
                  <td className={`text-right ${resta === 0 ? "font-bold text-red-700" : ""}`}>{resta == null ? "—" : resta === 0 ? "Esgotado" : resta}</td>
                  <td className="text-right">{moeda(valorPorItem.get(i.id) ?? 0)}</td>
                </tr>
              );
            })}
            {itens.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-stone-500">Nenhum item nesta venda. <Link href={`/painel/vendas/${venda.id}/editar`} className="link">Adicionar itens</Link></td></tr>
            )}
          </tbody>
        </table>
      </section>

      <ListaPedidos pedidos={pedidos} />
    </div>
  );
}
