"use client";

import { useMemo, useState } from "react";
import { ROTULO_ESTADO, ROTULO_MEIO, ROTULO_PAGAR, estadoPedido, linkWhatsApp, telefoneBR, type EstadoPedido } from "@/lib/dominio";
import { horaBR, moeda } from "@/lib/formato";
import type { PedidoComItens } from "@/lib/vendas";
import { IconeBusca, IconeWhatsApp } from "@/components/icones";
import { cancelarPedido, desfazerEntregue, desfazerPago, marcarEntregue, marcarPago } from "../../pedidos-actions";

const FILTROS: { id: "todos" | EstadoPedido; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "a_pagar", rotulo: "A pagar" },
  { id: "pago", rotulo: "Pagos" },
  { id: "entregue", rotulo: "Entregues" },
  { id: "cancelado", rotulo: "Cancelados" },
];

const COR = {
  a_pagar: "bg-amarelo-claro text-amber-900",
  pago: "bg-green-100 text-green-800",
  entregue: "bg-marinho-claro text-marinho",
  cancelado: "bg-red-100 text-red-700",
} as const;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ListaPedidos({ pedidos }: { pedidos: PedidoComItens[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | EstadoPedido>("todos");

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos.length };
    for (const p of pedidos) c[estadoPedido(p)] = (c[estadoPedido(p)] ?? 0) + 1;
    return c;
  }, [pedidos]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pedidos.filter((p) => {
      if (filtro !== "todos" && estadoPedido(p) !== filtro) return false;
      if (!termo) return true;
      return semAcento(p.clienteNome).includes(termo) || String(p.numero) === termo.replace(/\D/g, "") || (p.clienteTelefone ?? "").includes(termo.replace(/\D/g, "") || "#");
    });
  }, [pedidos, busca, filtro]);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-titulos text-xl font-bold text-marinho">Pedidos</h2>
        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Buscar por nome ou número</span>
          <IconeBusca className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou nº" className="campo pl-10" />
        </label>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${filtro === f.id ? "bg-marinho text-white" : "bg-white text-stone-600 ring-1 ring-[#ece4d8] hover:bg-stone-50"}`}
          >
            {f.rotulo} <span className="opacity-70">{contagem[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {visiveis.map((p) => (
          <CartaoPedido key={p.id} p={p} />
        ))}
      </ul>
      {visiveis.length === 0 && <p className="py-10 text-center text-sm text-stone-500">{pedidos.length ? "Nenhum pedido encontrado." : "Ainda não chegou nenhum pedido."}</p>}
    </section>
  );
}

function CartaoPedido({ p }: { p: PedidoComItens }) {
  const estado = estadoPedido(p);
  const ativo = estado !== "cancelado";
  return (
    <li className={`cartao p-4 ${estado === "cancelado" ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marinho font-titulos text-xl font-bold text-amarelo">{p.numero}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{p.clienteNome}</p>
          <p className="text-xs text-stone-500">
            {horaBR(p.criadoEm)} · {p.origem === "balcao" ? "Balcão" : ROTULO_PAGAR[p.pagarQuando]}
            {p.clienteTelefone && (
              <>
                {" · "}
                <a href={linkWhatsApp(p.clienteTelefone, `Olá, ${p.clienteNome.split(" ")[0]}! Sobre o seu pedido nº ${p.numero} da cantina:`)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-[#178a45]">
                  <IconeWhatsApp width={13} height={13} /> {telefoneBR(p.clienteTelefone)}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-titulos text-lg font-bold text-marinho">{moeda(p.total)}</p>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${COR[estado]}`}>
            {estado === "pago" ? "Pago" : ROTULO_ESTADO[estado]}
            {p.pagoCom && estado !== "a_pagar" && estado !== "cancelado" ? ` · ${ROTULO_MEIO[p.pagoCom]}` : ""}
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-0.5 border-t border-[#f1ebe1] pt-2 text-sm">
        {p.itens.map((i) => (
          <li key={i.id}><strong>{i.quantidade}×</strong> {i.nome}</li>
        ))}
      </ul>
      {p.observacao && <p className="mt-1 rounded-lg bg-amarelo-claro px-2.5 py-1.5 text-sm text-amber-950">Obs.: {p.observacao}</p>}

      {ativo && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!p.pagoEm ? (
            <>
              <Acao action={marcarPago} id={p.id} extra={{ meio: "pix" }} classe="botao flex-1 bg-green-700 hover:bg-green-800">Recebi Pix</Acao>
              <Acao action={marcarPago} id={p.id} extra={{ meio: "dinheiro" }} classe="botao flex-1 bg-green-700 hover:bg-green-800">Recebi dinheiro</Acao>
            </>
          ) : (
            !p.entregueEm && <Acao action={desfazerPago} id={p.id} classe="botao-sec text-xs" confirmar="Desfazer o pagamento deste pedido?">Desfazer pago</Acao>
          )}
          {!p.entregueEm ? (
            <Acao action={marcarEntregue} id={p.id} classe="botao flex-1" confirmar={p.pagoEm ? undefined : "Este pedido ainda não foi pago. Entregar mesmo assim?"}>Entregar</Acao>
          ) : (
            <Acao action={desfazerEntregue} id={p.id} classe="botao-sec text-xs" confirmar="Desfazer a entrega deste pedido?">Desfazer entrega</Acao>
          )}
          {!p.entregueEm && (
            <Acao action={cancelarPedido} id={p.id} classe="botao-perigo text-xs" confirmar={`Cancelar o pedido nº ${p.numero} de ${p.clienteNome}? Os itens voltam para a venda.${p.pagoEm ? " Atenção: este pedido já foi pago, devolva o valor." : ""}`}>
              Cancelar
            </Acao>
          )}
        </div>
      )}
    </li>
  );
}

function Acao({ action, id, extra, classe, confirmar, children }: { action: (f: FormData) => Promise<void>; id: number; extra?: Record<string, string>; classe: string; confirmar?: string; children: React.ReactNode }) {
  return (
    <form
      action={action}
      className="contents"
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={classe}>{children}</button>
    </form>
  );
}
