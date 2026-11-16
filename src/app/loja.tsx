"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PagarQuando } from "@/db/schema";
import { QTD_MAX_POR_ITEM, restante } from "@/lib/dominio";
import { centavos, moeda } from "@/lib/formato";
import type { ItemVitrine } from "@/lib/vendas";
import { IconeMais, IconeMenos } from "@/components/icones";
import { fazerPedido } from "./actions";

const CHAVE_CLIENTE = "cantina:cliente";
const CHAVE_PEDIDOS = "cantina:pedidos";

export type PedidoGuardado = { codigo: string; numero?: number; vendaId: number; quando: string };

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Navegação anônima: só não lembra os dados na próxima visita.
  }
}

export function Loja({ vendaId, itens, pixDisponivel }: { vendaId: number; itens: ItemVitrine[]; pixDisponivel: boolean }) {
  const router = useRouter();
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pagar, setPagar] = useState<PagarQuando | null>(pixDisponivel ? null : "na_retirada");
  const [erro, setErro] = useState("");
  const [meus, setMeus] = useState<PedidoGuardado[]>([]);
  const [enviando, iniciar] = useTransition();
  const formulario = useRef<HTMLDivElement>(null);

  // Lembra nome e WhatsApp de quem já pediu, e os pedidos feitos neste celular.
  useEffect(() => {
    const c = ler(CHAVE_CLIENTE, { nome: "", telefone: "" });
    /* eslint-disable react-hooks/set-state-in-effect -- leitura única do armazenamento do navegador */
    setNome(c.nome);
    setTelefone(c.telefone);
    setMeus(ler<PedidoGuardado[]>(CHAVE_PEDIDOS, []).filter((p) => p.vendaId === vendaId));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [vendaId]);

  const escolhidos = useMemo(() => itens.filter((i) => (qtd[i.id] ?? 0) > 0), [itens, qtd]);
  const total = centavos(escolhidos.reduce((s, i) => s + i.preco * qtd[i.id], 0));
  const unidades = escolhidos.reduce((s, i) => s + qtd[i.id], 0);

  function mudar(item: ItemVitrine, delta: number) {
    const max = Math.min(QTD_MAX_POR_ITEM, restante(item.limite, item.reservado) ?? QTD_MAX_POR_ITEM);
    setQtd((a) => ({ ...a, [item.id]: Math.max(0, Math.min(max, (a[item.id] ?? 0) + delta)) }));
    setErro("");
  }

  function enviar() {
    setErro("");
    if (!escolhidos.length) return setErro("Escolha pelo menos um item.");
    if (nome.trim().length < 2) return setErro("Informe seu nome.");
    if (telefone.replace(/\D/g, "").length < 10) return setErro("Informe seu WhatsApp com DDD.");
    if (!pagar) return setErro("Escolha como vai pagar.");
    iniciar(async () => {
      const r = await fazerPedido({
        vendaId,
        nome,
        telefone,
        observacao,
        pagarQuando: pagar,
        itens: escolhidos.map((i) => ({ vendaItemId: i.id, quantidade: qtd[i.id] })),
      });
      if ("erro" in r) {
        setErro(r.erro);
        router.refresh();
        return;
      }
      gravar(CHAVE_CLIENTE, { nome: nome.trim(), telefone: telefone.trim() });
      gravar(CHAVE_PEDIDOS, [{ codigo: r.codigo, vendaId, quando: new Date().toISOString() }, ...ler<PedidoGuardado[]>(CHAVE_PEDIDOS, [])].slice(0, 20));
      router.push(`/pedido/${r.codigo}`);
    });
  }

  return (
    <>
      {meus.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amarelo/60 bg-amarelo-claro px-4 py-3 text-sm">
          <p className="font-semibold text-marinho">Você já fez {meus.length === 1 ? "um pedido" : `${meus.length} pedidos`} nesta venda</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {meus.map((p, i) => (
              <a key={p.codigo} href={`/pedido/${p.codigo}`} className="link">
                Ver pedido {meus.length > 1 ? i + 1 : ""} →
              </a>
            ))}
          </div>
        </div>
      )}

      <section aria-labelledby="cardapio" className="cartao p-0">
        <h2 id="cardapio" className="px-5 pt-5 font-titulos text-2xl font-bold text-marinho">Cardápio</h2>
        <p className="px-5 text-sm text-stone-500">Escolha as quantidades e confirme no final da página.</p>
        <ul className="mt-3 divide-y divide-[#f1ebe1]">
          {itens.map((item) => {
            const resta = restante(item.limite, item.reservado);
            const esgotado = resta === 0;
            const q = qtd[item.id] ?? 0;
            return (
              <li key={item.id} className={`flex items-center gap-4 px-5 py-4 ${esgotado ? "opacity-55" : ""}`}>
                {item.imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- fotos cadastradas por endereço
                  <img src={item.imagemUrl} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span aria-hidden className="grid size-20 shrink-0 place-items-center rounded-2xl bg-amarelo-claro text-4xl">
                    {item.emoji || "🍽️"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="leading-snug font-bold text-tinta">{item.nome}</h3>
                  {item.descricao && <p className="mt-0.5 text-sm leading-snug text-stone-500">{item.descricao}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-titulos text-lg font-bold text-marinho">{moeda(item.preco)}</span>
                    {esgotado ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">Esgotado</span>
                    ) : resta != null && resta <= 15 ? (
                      <span className="rounded-full bg-amarelo-claro px-2 py-0.5 text-xs font-bold text-amber-800">
                        {resta === 1 ? "Último!" : `Restam ${resta}`}
                      </span>
                    ) : null}
                  </div>
                </div>
                {!esgotado &&
                  (q === 0 ? (
                    <button type="button" onClick={() => mudar(item, 1)} className="grid size-11 shrink-0 place-items-center rounded-full bg-marinho text-white shadow-sm transition active:scale-95" aria-label={`Adicionar ${item.nome}`}>
                      <IconeMais />
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-marinho-claro p-1">
                      <button type="button" onClick={() => mudar(item, -1)} className="grid size-9 place-items-center rounded-full bg-white text-marinho shadow-sm active:scale-95" aria-label={`Tirar um ${item.nome}`}>
                        <IconeMenos width={18} height={18} />
                      </button>
                      <span className="w-7 text-center font-bold text-marinho" aria-live="polite">{q}</span>
                      <button
                        type="button"
                        onClick={() => mudar(item, 1)}
                        disabled={resta != null && q >= resta}
                        className="grid size-9 place-items-center rounded-full bg-marinho text-white shadow-sm active:scale-95 disabled:opacity-40"
                        aria-label={`Mais um ${item.nome}`}
                      >
                        <IconeMais width={18} height={18} />
                      </button>
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>
      </section>

      <section ref={formulario} aria-labelledby="dados" className="cartao mt-4 scroll-mt-4">
        <h2 id="dados" className="font-titulos text-2xl font-bold text-marinho">Seus dados</h2>
        <p className="text-sm text-stone-500">Para separarmos o seu pedido com o seu nome.</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="rotulo">Seu nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="campo" autoComplete="name" maxLength={80} placeholder="Como devemos chamar você" />
          </label>
          <label className="block">
            <span className="rotulo">WhatsApp</span>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="campo" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="(62) 99999-0000" />
          </label>

          <fieldset>
            <legend className="rotulo">Como vai pagar?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {pixDisponivel && (
                <Opcao marcada={pagar === "pix_agora"} onClick={() => setPagar("pix_agora")} icone="⚡" titulo="Pix agora" texto="Pague pelo Pix e só retire" />
              )}
              <Opcao marcada={pagar === "na_retirada"} onClick={() => setPagar("na_retirada")} icone="🤝" titulo="Na retirada" texto="Pix ou dinheiro na cantina" />
            </div>
          </fieldset>

          <label className="block">
            <span className="rotulo">Observação (opcional)</span>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className="campo" maxLength={300} placeholder="Ex.: sabor da pamonha, bebida do combo…" />
          </label>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece4d8] bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,39,71,0.08)] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {erro && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-stone-500">{unidades === 0 ? "Nenhum item" : unidades === 1 ? "1 item" : `${unidades} itens`}</p>
              <p className="font-titulos text-2xl leading-tight font-bold text-marinho">{moeda(total)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                // Escolheu os itens mas falta nome/WhatsApp/pagamento: leva até os campos e diz o que falta.
                if (unidades > 0 && !(nome.trim() && telefone.trim() && pagar)) formulario.current?.scrollIntoView({ behavior: "smooth" });
                enviar();
              }}
              disabled={enviando}
              className="rounded-2xl bg-amarelo px-6 py-3.5 text-base font-extrabold text-marinho shadow-sm transition hover:bg-amarelo-escuro active:scale-[0.98] disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Fazer pedido"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Opcao({ marcada, onClick, icone, titulo, texto }: { marcada: boolean; onClick: () => void; icone: string; titulo: string; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marcada}
      className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition ${marcada ? "border-marinho bg-marinho-claro" : "border-[#ece4d8] bg-white hover:border-stone-300"}`}
    >
      <span className="text-2xl" aria-hidden>{icone}</span>
      <span>
        <span className="block font-bold text-tinta">{titulo}</span>
        <span className="block text-xs text-stone-500">{texto}</span>
      </span>
    </button>
  );
}
