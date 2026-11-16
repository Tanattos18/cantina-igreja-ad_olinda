import { asc, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { moeda } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { InputImagem } from "@/components/input-imagem";
import { urlImagem } from "@/lib/imagens";
import { restante } from "@/lib/dominio";
import { itensDaVenda, vendaAberta } from "@/lib/vendas";
import { abrirCantina } from "../vendas/actions";
import { alternarNaVenda, alternarProduto, definirQuantidade, salvarProduto } from "./actions";

export const metadata = { title: "Cardápio — Painel" };

const valorBR = (v: number) => v.toFixed(2).replace(".", ",");

function CamposProduto({ p, categorias }: { p?: typeof schema.produtos.$inferSelect; categorias: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[80px_1fr_120px]">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Campo rotulo="Emoji">
        <input name="emoji" className="campo text-center text-xl" maxLength={16} defaultValue={p?.emoji ?? ""} placeholder="🌽" />
      </Campo>
      <Campo rotulo="Nome">
        <input name="nome" className="campo" required maxLength={80} defaultValue={p?.nome} />
      </Campo>
      <Campo rotulo="Preço (R$)">
        <input name="preco" className="campo" inputMode="decimal" required defaultValue={p ? valorBR(p.preco) : ""} placeholder="8,00" />
      </Campo>
      <Campo rotulo="Categoria (aba na loja)" className="sm:col-span-3">
        <input name="categoria" className="campo" maxLength={40} list="categorias" defaultValue={p?.categoria ?? ""} placeholder="Ex.: Pamonhas, Salgados, Combos" />
        <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
      </Campo>
      <Campo rotulo="Descrição (opcional)" className="sm:col-span-3">
        <input name="descricao" className="campo" maxLength={200} defaultValue={p?.descricao ?? ""} placeholder="Ex.: sabores sal, doce ou à moda" />
      </Campo>
      <div className="sm:col-span-3">
        <InputImagem name="foto" rotulo="Foto (opcional; sem foto, aparece o emoji)" atual={urlImagem(p?.imagemId)} />
      </div>
    </div>
  );
}

/** Chave liga/desliga: o produto está ou não na loja da venda aberta. */
function ChaveAVenda({ produtoId, ligado }: { produtoId: number; ligado: boolean }) {
  return (
    <form action={alternarNaVenda}>
      <input type="hidden" name="produtoId" value={produtoId} />
      <input type="hidden" name="ligar" value={ligado ? "0" : "1"} />
      <button
        aria-pressed={ligado}
        className={`flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-bold transition ${ligado ? "bg-green-100 text-green-900" : "bg-stone-100 text-stone-600"}`}
      >
        <span className={`relative h-7 w-12 rounded-full transition ${ligado ? "bg-green-600" : "bg-stone-300"}`}>
          <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${ligado ? "left-6" : "left-1"}`} />
        </span>
        {ligado ? "À venda" : "Fora da venda"}
      </button>
    </form>
  );
}

export default async function ProdutosPage() {
  await exigirUsuario();
  const db = await getDb();
  const [produtos, venda] = await Promise.all([
    db.select().from(schema.produtos).orderBy(desc(schema.produtos.ativo), asc(schema.produtos.categoria), asc(schema.produtos.nome)),
    vendaAberta(db),
  ]);
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))].sort();
  const naVenda = new Map((venda ? await itensDaVenda(db, venda.id) : []).map((i) => [i.produtoId, i]));

  return (
    <div className="max-w-3xl">
      <Cabecalho
        titulo="Cardápio"
        descricao={venda ? "Ligue ou desligue cada item da loja e informe quantas unidades tem. Muda na hora para quem abre o link." : "Tudo o que a cantina costuma vender."}
      />

      {!venda && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-green-700/30 bg-green-50 px-5 py-4">
          <p className="min-w-0 flex-1 text-sm text-green-900">
            Com a cantina aberta, aqui aparecem a chave <strong>À venda</strong> e a <strong>quantidade</strong> de cada item.
          </p>
          <form action={abrirCantina}>
            <button className="botao bg-green-700 hover:bg-green-800">🟢 Abrir a cantina agora</button>
          </form>
        </div>
      )}

      <details className="cartao mb-6">
        <summary className="cursor-pointer font-titulos text-lg font-bold text-marinho">+ Novo produto</summary>
        <ActionForm action={salvarProduto} botao="Cadastrar" className="mt-4">
          <CamposProduto categorias={categorias} />
        </ActionForm>
      </details>

      <ul className="space-y-3">
        {produtos.map((p) => {
          const item = naVenda.get(p.id);
          const ligado = !!item?.ativo;
          const resta = item ? restante(item.limite, item.reservado) : null;
          return (
          <li key={p.id} className={`cartao p-4 ${p.ativo ? "" : "opacity-60"} ${venda && p.ativo && !ligado ? "bg-stone-50" : ""}`}>
            <div className="flex items-center gap-3">
              {p.imagemId ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo painel
                <img src={urlImagem(p.imagemId)!} alt="" className={`size-14 shrink-0 rounded-xl object-cover ${venda && !ligado ? "grayscale" : ""}`} />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-amarelo-claro text-2xl" aria-hidden>{p.emoji || "🍽️"}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{p.nome}{!p.ativo && <span className="ml-2 text-xs font-semibold text-stone-500">fora do cardápio</span>}</span>
                <span className="block truncate text-sm text-stone-500">{[p.categoria, p.descricao].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="font-titulos text-lg font-bold text-marinho">{moeda(item?.preco ?? p.preco)}</span>
            </div>

            {venda && p.ativo && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#f1ebe1] pt-3">
                <ChaveAVenda produtoId={p.id} ligado={ligado} />
                {ligado && item && (
                  <>
                    <ActionForm action={definirQuantidade} botao="Salvar" botaoClasse="botao-sec py-2" className="flex items-center gap-2 [&>div]:mt-0">
                      <input type="hidden" name="vendaItemId" value={item.id} />
                      <label className="flex items-center gap-2 text-sm font-semibold text-stone-600">
                        Quantidade
                        <input name="limite" type="number" min={0} inputMode="numeric" className="campo w-32 py-2 text-sm" placeholder="sem limite" defaultValue={item.limite ?? ""} />
                      </label>
                    </ActionForm>
                    <span className="text-xs font-semibold text-stone-500">
                      {item.reservado} pedido{item.reservado === 1 ? "" : "s"}
                      {resta != null && (resta === 0 ? <span className="ml-1 text-red-700">· Esgotado</span> : <> · restam {resta}</>)}
                    </span>
                  </>
                )}
              </div>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-marinho">Editar produto</summary>
              <ActionForm action={salvarProduto} className="mt-4 border-t border-[#f1ebe1] pt-4">
                <CamposProduto p={p} categorias={categorias} />
              </ActionForm>
              <form action={alternarProduto} className="mt-3">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="ativo" value={String(!p.ativo)} />
                <button className={p.ativo ? "botao-perigo" : "botao-sec"}>{p.ativo ? "Tirar do cardápio de vez" : "Voltar ao cardápio"}</button>
              </form>
            </details>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
