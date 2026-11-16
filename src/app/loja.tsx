"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PagarQuando } from "@/db/schema";
import { QTD_MAX_POR_ITEM, restante } from "@/lib/dominio";
import { centavos, moeda } from "@/lib/formato";
import type { ItemVitrine } from "@/lib/vendas";
import { IconeFechar, IconeLixeira, IconeMais, IconeMenos, IconeSacola, IconeVoltar } from "@/components/icones";
import { fazerPedido } from "./actions";

const CHAVE_CLIENTE = "cantina:cliente";
const CHAVE_PEDIDOS = "cantina:pedidos";
const SEM_CATEGORIA = "Cardápio";

type PedidoGuardado = { codigo: string; vendaId: number; quando: string };
type Etapa = "cardapio" | "revisar" | "dados";

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

const maximo = (i: ItemVitrine) => Math.min(QTD_MAX_POR_ITEM, restante(i.limite, i.reservado) ?? QTD_MAX_POR_ITEM);
const idCategoria = (c: string) => `cat-${c.normalize("NFD").replace(/[^\w]/g, "-").toLowerCase()}`;

/** Loja no estilo totem de autoatendimento: abas de categoria, cards grandes e pedido em etapas. */
export function Loja({ vendaId, itens, pixDisponivel }: { vendaId: number; itens: ItemVitrine[]; pixDisponivel: boolean }) {
  const router = useRouter();
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [etapa, setEtapa] = useState<Etapa>("cardapio");
  const [aberto, setAberto] = useState<ItemVitrine | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pagar, setPagar] = useState<PagarQuando | null>(pixDisponivel ? null : "na_retirada");
  const [erro, setErro] = useState("");
  const [meus, setMeus] = useState<PedidoGuardado[]>([]);
  const [enviando, iniciar] = useTransition();

  const categorias = useMemo(() => {
    const m = new Map<string, ItemVitrine[]>();
    for (const i of itens) {
      const c = i.categoria?.trim() || SEM_CATEGORIA;
      m.set(c, [...(m.get(c) ?? []), i]);
    }
    return [...m];
  }, [itens]);
  const [ativa, setAtiva] = useState(categorias[0]?.[0] ?? "");

  useEffect(() => {
    const c = ler(CHAVE_CLIENTE, { nome: "", telefone: "" });
    /* eslint-disable react-hooks/set-state-in-effect -- leitura única do armazenamento do navegador */
    setNome(c.nome);
    setTelefone(c.telefone);
    setMeus(ler<PedidoGuardado[]>(CHAVE_PEDIDOS, []).filter((p) => p.vendaId === vendaId));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [vendaId]);

  // Destaca a aba da categoria que está na tela.
  useEffect(() => {
    if (etapa !== "cardapio" || categorias.length < 2) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtiva(visivel.target.getAttribute("data-categoria") ?? "");
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    document.querySelectorAll("[data-categoria]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [etapa, categorias]);

  useEffect(() => {
    document.body.style.overflow = aberto || etapa !== "cardapio" ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto, etapa]);

  const escolhidos = itens.filter((i) => (qtd[i.id] ?? 0) > 0);
  const total = centavos(escolhidos.reduce((s, i) => s + i.preco * qtd[i.id], 0));
  const unidades = escolhidos.reduce((s, i) => s + qtd[i.id], 0);

  function definir(item: ItemVitrine, q: number) {
    setQtd((a) => ({ ...a, [item.id]: Math.max(0, Math.min(maximo(item), q)) }));
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

  const resumo = (
    <ResumoPedido
      itens={escolhidos}
      qtd={qtd}
      total={total}
      definir={definir}
      continuar={() => {
        setErro("");
        setEtapa("dados");
      }}
    />
  );

  return (
    <>
      {categorias.length > 1 && (
        <nav aria-label="Categorias" className="sticky top-0 z-20 -mx-4 bg-creme/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {categorias.map(([c, lista]) => (
              <a
                key={c}
                href={`#${idCategoria(c)}`}
                onClick={() => setAtiva(c)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold transition ${ativa === c ? "bg-marinho text-amarelo shadow-md" : "bg-white text-marinho ring-1 ring-[#ece4d8]"}`}
              >
                <span className="text-lg" aria-hidden>{lista[0].emoji || "🍽️"}</span>
                {c}
              </a>
            ))}
          </div>
        </nav>
      )}

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)_320px] lg:gap-6">
        {/* Abas grandes à esquerda, como num totem (computador e tablet deitado). */}
        <nav aria-label="Categorias" className="hidden lg:block">
          <div className="sticky top-6 space-y-2">
            {categorias.map(([c, lista]) => (
              <a
                key={c}
                href={`#${idCategoria(c)}`}
                onClick={() => setAtiva(c)}
                className={`flex flex-col items-center gap-1 rounded-3xl px-3 py-4 text-center font-extrabold transition ${ativa === c ? "bg-marinho text-amarelo shadow-lg" : "bg-white text-marinho ring-1 ring-[#ece4d8] hover:ring-marinho/40"}`}
              >
                <span className="text-4xl" aria-hidden>{lista[0].emoji || "🍽️"}</span>
                <span className="text-sm leading-tight">{c}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          {meus.length > 0 && (
            <div className="mt-3 mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-amarelo-claro px-4 py-3 text-sm lg:mt-0">
              <span className="font-bold text-marinho">✔ Você já pediu nesta venda</span>
              {meus.map((p, i) => (
                <a key={p.codigo} href={`/pedido/${p.codigo}`} className="link">
                  Ver pedido{meus.length > 1 ? ` ${i + 1}` : ""} →
                </a>
              ))}
            </div>
          )}

          {categorias.map(([c, lista]) => (
            <section key={c} id={idCategoria(c)} data-categoria={c} className="scroll-mt-20 pt-4 lg:scroll-mt-6">
              <h2 className="mb-3 font-titulos text-2xl font-bold text-marinho">{c}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {lista.map((item) => (
                  <Card key={item.id} item={item} q={qtd[item.id] ?? 0} abrir={() => setAberto(item)} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6">{resumo}</div>
        </aside>
      </div>

      {/* Barra do pedido no celular. */}
      <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          disabled={unidades === 0}
          onClick={() => setEtapa("revisar")}
          className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl bg-amarelo px-4 py-3.5 text-left text-marinho shadow-[0_10px_30px_rgba(15,39,71,0.35)] transition active:scale-[0.98] disabled:bg-white disabled:text-stone-400 disabled:shadow-[0_6px_20px_rgba(15,39,71,0.12)]"
        >
          <span className="relative grid size-11 place-items-center rounded-xl bg-marinho text-amarelo">
            <IconeSacola />
            {unidades > 0 && <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-red-600 text-xs font-bold text-white ring-2 ring-amarelo">{unidades}</span>}
          </span>
          <span className="flex-1 font-extrabold">{unidades === 0 ? "Toque num item para começar" : "Ver meu pedido"}</span>
          {unidades > 0 && <span className="font-titulos text-xl font-bold">{moeda(total)}</span>}
        </button>
      </div>

      {aberto && <JanelaItem item={aberto} atual={qtd[aberto.id] ?? 0} fechar={() => setAberto(null)} salvar={(q) => { definir(aberto, q); setAberto(null); }} />}

      {etapa !== "cardapio" && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-creme">
          <header className="sticky top-0 z-10 bg-marinho text-white">
            <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
              <button type="button" onClick={() => setEtapa(etapa === "dados" ? "revisar" : "cardapio")} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Voltar">
                <IconeVoltar />
              </button>
              <ol className="flex flex-1 items-center justify-center gap-2 text-xs font-bold">
                {(["Seu pedido", "Seus dados"] as const).map((rotulo, i) => {
                  const atual = (etapa === "revisar" ? 0 : 1) === i;
                  return (
                    <li key={rotulo} className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${atual ? "bg-amarelo text-marinho" : "text-blue-200"}`}>
                      <span className={`grid size-5 place-items-center rounded-full ${atual ? "bg-marinho text-amarelo" : "bg-white/15"}`}>{i + 1}</span>
                      {rotulo}
                    </li>
                  );
                })}
              </ol>
              <span className="size-10" aria-hidden />
            </div>
          </header>

          <div className="mx-auto max-w-2xl px-4 pt-5 pb-36">
            {etapa === "revisar" ? (
              <>
                <h2 className="font-titulos text-3xl font-bold text-marinho">Confira seu pedido</h2>
                <ul className="mt-4 space-y-3">
                  {escolhidos.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-[#ece4d8]">
                      <Miniatura item={i} className="size-16 text-3xl" />
                      <div className="min-w-0 flex-1">
                        <p className="leading-tight font-bold">{i.nome}</p>
                        <p className="text-sm text-stone-500">{moeda(i.preco)} cada</p>
                        <p className="font-titulos text-lg font-bold text-marinho">{moeda(i.preco * qtd[i.id])}</p>
                      </div>
                      <Contador q={qtd[i.id]} max={maximo(i)} mudar={(q) => definir(i, q)} nome={i.nome} />
                    </li>
                  ))}
                </ul>
                {escolhidos.length === 0 && <p className="mt-6 text-center text-stone-500">Seu pedido está vazio.</p>}
                <button type="button" onClick={() => setEtapa("cardapio")} className="mt-4 w-full rounded-2xl border-2 border-dashed border-marinho/30 py-3.5 font-bold text-marinho hover:bg-white">
                  + Adicionar mais itens
                </button>
              </>
            ) : (
              <>
                <h2 className="font-titulos text-3xl font-bold text-marinho">Quase lá!</h2>
                <p className="text-stone-600">Seu pedido fica separado com o seu nome.</p>
                <div className="mt-5 space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#ece4d8]">
                  <label className="block">
                    <span className="rotulo">Seu nome</span>
                    <input value={nome} onChange={(e) => setNome(e.target.value)} className="campo py-3 text-lg" autoComplete="name" maxLength={80} placeholder="Como devemos chamar você" />
                  </label>
                  <label className="block">
                    <span className="rotulo">WhatsApp</span>
                    <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="campo py-3 text-lg" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="(62) 99999-0000" />
                  </label>
                  <label className="block">
                    <span className="rotulo">Observação (opcional)</span>
                    <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className="campo" maxLength={300} placeholder="Ex.: sabor da pamonha, bebida do combo…" />
                  </label>
                </div>

                <h3 className="mt-6 mb-3 font-titulos text-xl font-bold text-marinho">Como você vai pagar?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {pixDisponivel && (
                    <OpcaoPagamento marcada={pagar === "pix_agora"} onClick={() => setPagar("pix_agora")} icone="⚡" titulo="Pix agora" texto="QR code na próxima tela" />
                  )}
                  <OpcaoPagamento marcada={pagar === "na_retirada"} onClick={() => setPagar("na_retirada")} icone="🤝" titulo="Na retirada" texto="Pix ou dinheiro na cantina" />
                </div>
              </>
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 border-t border-[#ece4d8] bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-2xl">
              {erro && <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase">Total</p>
                  <p className="font-titulos text-2xl leading-tight font-bold text-marinho">{moeda(total)}</p>
                </div>
                {etapa === "revisar" ? (
                  <button type="button" disabled={unidades === 0} onClick={() => setEtapa("dados")} className="flex-1 rounded-2xl bg-amarelo py-4 text-lg font-extrabold text-marinho shadow-sm hover:bg-amarelo-escuro disabled:opacity-50">
                    Continuar
                  </button>
                ) : (
                  <button type="button" disabled={enviando} onClick={enviar} className="flex-1 rounded-2xl bg-amarelo py-4 text-lg font-extrabold text-marinho shadow-sm hover:bg-amarelo-escuro disabled:opacity-60">
                    {enviando ? "Enviando…" : "Confirmar pedido"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Miniatura({ item, className }: { item: ItemVitrine; className: string }) {
  return item.imagemUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo painel
    <img src={item.imagemUrl} alt="" className={`shrink-0 rounded-2xl object-cover ${className}`} />
  ) : (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amarelo-claro to-amarelo/50 ${className}`}>
      {item.emoji || "🍽️"}
    </span>
  );
}

function Card({ item, q, abrir }: { item: ItemVitrine; q: number; abrir: () => void }) {
  const resta = restante(item.limite, item.reservado);
  const esgotado = resta === 0;
  return (
    <button
      type="button"
      onClick={abrir}
      disabled={esgotado}
      className={`group relative flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-2 transition active:scale-[0.97] ${q > 0 ? "ring-marinho" : "ring-transparent hover:ring-amarelo"} disabled:active:scale-100`}
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-amarelo-claro via-[#fbe7a3] to-amarelo/70">
        {item.imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo painel
          <img src={item.imagemUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <span aria-hidden className="grid size-full place-items-center text-7xl drop-shadow-md transition duration-300 group-hover:scale-110 sm:text-8xl">
            {item.emoji || "🍽️"}
          </span>
        )}
        {q > 0 && <span className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-marinho text-base font-extrabold text-amarelo shadow-lg">{q}</span>}
        {!esgotado && resta != null && resta <= 15 && (
          <span className="absolute bottom-2 left-2 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow">
            {resta === 1 ? "Último!" : `Restam ${resta}`}
          </span>
        )}
        {esgotado && (
          <span className="absolute inset-0 grid place-items-center bg-white/70">
            <span className="-rotate-6 rounded-xl bg-red-600 px-4 py-1.5 text-lg font-extrabold tracking-wide text-white uppercase shadow-lg">Esgotado</span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <span className="line-clamp-2 leading-tight font-extrabold text-tinta">{item.nome}</span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="font-titulos text-xl font-bold text-marinho">{moeda(item.preco)}</span>
          {!esgotado && (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amarelo text-marinho shadow-sm transition group-hover:bg-amarelo-escuro" aria-hidden>
              <IconeMais />
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

function Contador({ q, max, mudar, nome, grande }: { q: number; max: number; mudar: (q: number) => void; nome: string; grande?: boolean }) {
  const tam = grande ? "size-14" : "size-10";
  return (
    <div className={`flex shrink-0 items-center rounded-full bg-marinho-claro p-1 ${grande ? "gap-4" : "gap-1"}`}>
      <button type="button" onClick={() => mudar(q - 1)} className={`grid ${tam} place-items-center rounded-full bg-white text-marinho shadow-sm active:scale-95`} aria-label={q === 1 && !grande ? `Remover ${nome}` : `Menos um ${nome}`}>
        {q === 1 && !grande ? <IconeLixeira width={18} height={18} /> : <IconeMenos />}
      </button>
      <span className={`text-center font-extrabold text-marinho ${grande ? "w-10 text-3xl" : "w-6 text-lg"}`} aria-live="polite">{q}</span>
      <button type="button" onClick={() => mudar(q + 1)} disabled={q >= max} className={`grid ${tam} place-items-center rounded-full bg-marinho text-amarelo shadow-sm active:scale-95 disabled:opacity-40`} aria-label={`Mais um ${nome}`}>
        <IconeMais />
      </button>
    </div>
  );
}

/** Janela do item (como a tela de personalizar do totem): foto grande, quantidade e "Adicionar ao pedido". */
function JanelaItem({ item, atual, fechar, salvar }: { item: ItemVitrine; atual: number; fechar: () => void; salvar: (q: number) => void }) {
  const [q, setQ] = useState(Math.max(1, atual));
  const max = maximo(item);
  const resta = restante(item.limite, item.reservado);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-marinho-escuro/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={fechar} role="dialog" aria-modal="true" aria-label={item.nome}>
      <div className="relative w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={fechar} className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-marinho shadow" aria-label="Fechar">
          <IconeFechar />
        </button>
        <div className="aspect-[4/3] bg-gradient-to-br from-amarelo-claro via-[#fbe7a3] to-amarelo">
          {item.imagemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo painel
            <img src={item.imagemUrl} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden className="grid size-full place-items-center text-[9rem] drop-shadow-lg">{item.emoji || "🍽️"}</span>
          )}
        </div>
        <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <h2 className="font-titulos text-3xl leading-tight font-bold text-marinho">{item.nome}</h2>
          {item.descricao && <p className="mt-1 text-stone-600">{item.descricao}</p>}
          <p className="mt-2 flex items-center gap-2">
            <span className="font-titulos text-2xl font-bold text-tinta">{moeda(item.preco)}</span>
            {resta != null && <span className="rounded-full bg-amarelo-claro px-2.5 py-0.5 text-xs font-bold text-amber-900">Restam {resta}</span>}
          </p>
          <div className="mt-5 flex justify-center">
            <Contador grande q={q} max={max} mudar={(n) => setQ(Math.max(1, Math.min(max, n)))} nome={item.nome} />
          </div>
          <button type="button" onClick={() => salvar(q)} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-amarelo px-5 py-4 text-lg font-extrabold text-marinho shadow-sm hover:bg-amarelo-escuro active:scale-[0.98]">
            <span>{atual > 0 ? "Atualizar pedido" : "Adicionar ao pedido"}</span>
            <span>{moeda(item.preco * q)}</span>
          </button>
          {atual > 0 && (
            <button type="button" onClick={() => salvar(0)} className="mt-3 w-full py-2 text-sm font-bold text-red-700">
              Tirar do pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResumoPedido({ itens, qtd, total, definir, continuar }: { itens: ItemVitrine[]; qtd: Record<number, number>; total: number; definir: (i: ItemVitrine, q: number) => void; continuar: () => void }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#ece4d8]">
      <h2 className="flex items-center gap-2 bg-marinho px-5 py-4 font-titulos text-xl font-bold text-white">
        <IconeSacola className="text-amarelo" /> Meu pedido
      </h2>
      {itens.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-stone-500">Toque num item do cardápio para adicionar.</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-[#f1ebe1] overflow-y-auto">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{i.nome}</p>
                <p className="text-sm text-marinho">{moeda(i.preco * qtd[i.id])}</p>
              </div>
              <Contador q={qtd[i.id]} max={maximo(i)} mudar={(q) => definir(i, q)} nome={i.nome} />
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-[#ece4d8] p-4">
        <p className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-stone-500">Total</span>
          <span className="font-titulos text-2xl font-bold text-marinho">{moeda(total)}</span>
        </p>
        <button type="button" disabled={itens.length === 0} onClick={continuar} className="mt-3 w-full rounded-2xl bg-amarelo py-3.5 text-base font-extrabold text-marinho hover:bg-amarelo-escuro disabled:opacity-50">
          Finalizar pedido
        </button>
      </div>
    </div>
  );
}

function OpcaoPagamento({ marcada, onClick, icone, titulo, texto }: { marcada: boolean; onClick: () => void; icone: string; titulo: string; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marcada}
      className={`relative flex flex-col items-center gap-1 rounded-3xl border-[3px] bg-white px-3 py-5 text-center transition active:scale-[0.97] ${marcada ? "border-marinho shadow-lg" : "border-transparent shadow-sm ring-1 ring-[#ece4d8]"}`}
    >
      {marcada && <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-marinho text-xs font-bold text-amarelo">✓</span>}
      <span className="text-4xl" aria-hidden>{icone}</span>
      <span className="text-lg font-extrabold text-marinho">{titulo}</span>
      <span className="text-xs text-stone-500">{texto}</span>
    </button>
  );
}
