"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MeioRecebimento } from "@/db/schema";
import { ROTULO_MEIO, restante } from "@/lib/dominio";
import { centavos, moeda } from "@/lib/formato";
import type { ItemVitrine } from "@/lib/vendas";
import { venderNoBalcao } from "./actions";

/** Caixa rápido: toque no item para somar, escolha o pagamento e registre. */
export function Caixa({ vendaId, itens }: { vendaId: number; itens: ItemVitrine[] }) {
  const router = useRouter();
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [meio, setMeio] = useState<MeioRecebimento | null>(null);
  const [nome, setNome] = useState("");
  const [recebido, setRecebido] = useState("");
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>({});
  const [enviando, iniciar] = useTransition();

  const total = centavos(itens.reduce((s, i) => s + i.preco * (qtd[i.id] ?? 0), 0));
  const valorRecebido = Number(recebido.replace(/\./g, "").replace(",", ".")) || 0;
  const troco = meio === "dinheiro" && valorRecebido > 0 ? centavos(valorRecebido - total) : null;

  function somar(i: ItemVitrine, d: number) {
    const resta = restante(i.limite, i.reservado);
    setQtd((a) => ({ ...a, [i.id]: Math.max(0, Math.min(resta ?? 99, (a[i.id] ?? 0) + d)) }));
    setMsg({});
  }

  function registrar() {
    if (total === 0) return setMsg({ erro: "Toque nos itens vendidos." });
    if (!meio) return setMsg({ erro: "Escolha como a pessoa pagou." });
    iniciar(async () => {
      const r = await venderNoBalcao({
        vendaId,
        nome,
        meio,
        itens: Object.entries(qtd).filter(([, q]) => q > 0).map(([id, q]) => ({ vendaItemId: Number(id), quantidade: q })),
      });
      if ("erro" in r) {
        setMsg({ erro: r.erro });
      } else {
        setMsg({ ok: `Venda nº ${r.numero} registrada: ${moeda(r.total)} em ${ROTULO_MEIO[meio].toLowerCase()}.` });
        setQtd({});
        setMeio(null);
        setNome("");
        setRecebido("");
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {itens.map((i) => {
          const resta = restante(i.limite, i.reservado);
          const q = qtd[i.id] ?? 0;
          const esgotado = resta === 0;
          return (
            <div key={i.id} className={`relative rounded-2xl border-2 bg-white transition ${q > 0 ? "border-marinho" : "border-[#ece4d8]"} ${esgotado ? "opacity-50" : ""}`}>
              <button type="button" disabled={esgotado} onClick={() => somar(i, 1)} className="flex w-full flex-col items-center gap-1 p-4 text-center active:scale-[0.97]">
                <span className="text-4xl" aria-hidden>{i.emoji || "🍽️"}</span>
                <span className="text-sm leading-tight font-bold">{i.nome}</span>
                <span className="text-sm text-marinho">{moeda(i.preco)}</span>
                <span className="text-[11px] text-stone-500">{esgotado ? "Esgotado" : resta != null ? `restam ${resta - q}` : " "}</span>
              </button>
              {q > 0 && (
                <>
                  <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-marinho text-sm font-bold text-amarelo">{q}</span>
                  <button type="button" onClick={() => somar(i, -1)} className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-stone-100 text-lg leading-none font-bold text-stone-600" aria-label={`Tirar um ${i.nome}`}>
                    −
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <aside className="cartao h-fit space-y-4 lg:sticky lg:top-6">
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase">Total</p>
          <p className="font-titulos text-4xl font-bold text-marinho">{moeda(total)}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["dinheiro", "pix", "cartao"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMeio(m)} aria-pressed={meio === m} className={`rounded-xl border-2 py-2.5 text-sm font-bold ${meio === m ? "border-marinho bg-marinho text-white" : "border-[#ece4d8] bg-white"}`}>
              {ROTULO_MEIO[m]}
            </button>
          ))}
        </div>
        {meio === "dinheiro" && (
          <label className="block">
            <span className="rotulo">Valor recebido (para o troco)</span>
            <input value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" className="campo" placeholder="Ex.: 50" />
            {troco != null && (
              <p className={`mt-1 text-lg font-bold ${troco < 0 ? "text-red-700" : "text-green-700"}`}>
                {troco < 0 ? `Faltam ${moeda(-troco)}` : `Troco: ${moeda(troco)}`}
              </p>
            )}
          </label>
        )}
        <label className="block">
          <span className="rotulo">Nome (opcional)</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="campo" maxLength={80} />
        </label>
        {msg.erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{msg.erro}</p>}
        {msg.ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg.ok}</p>}
        <button type="button" onClick={registrar} disabled={enviando} className="w-full rounded-xl bg-amarelo py-3.5 text-base font-extrabold text-marinho hover:bg-amarelo-escuro disabled:opacity-60">
          {enviando ? "Registrando…" : "Registrar venda"}
        </button>
        {total > 0 && (
          <button type="button" onClick={() => setQtd({})} className="w-full text-sm text-stone-500 hover:text-red-700">Limpar</button>
        )}
      </aside>
    </div>
  );
}
