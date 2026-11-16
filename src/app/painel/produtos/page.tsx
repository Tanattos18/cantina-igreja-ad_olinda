import { asc, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { moeda } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { InputImagem } from "@/components/input-imagem";
import { urlImagem } from "@/lib/imagens";
import { alternarProduto, salvarProduto } from "./actions";

export const metadata = { title: "Cardápio — Painel" };

const valorBR = (v: number) => v.toFixed(2).replace(".", ",");

function CamposProduto({ p }: { p?: typeof schema.produtos.$inferSelect }) {
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
      <Campo rotulo="Descrição (opcional)" className="sm:col-span-3">
        <input name="descricao" className="campo" maxLength={200} defaultValue={p?.descricao ?? ""} placeholder="Ex.: sabores sal, doce ou à moda" />
      </Campo>
      <div className="sm:col-span-3">
        <InputImagem name="foto" rotulo="Foto (opcional; sem foto, aparece o emoji)" atual={urlImagem(p?.imagemId)} />
      </div>
    </div>
  );
}

export default async function ProdutosPage() {
  await exigirUsuario();
  const db = await getDb();
  const produtos = await db.select().from(schema.produtos).orderBy(desc(schema.produtos.ativo), asc(schema.produtos.nome));

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Cardápio" descricao="Tudo o que a cantina costuma vender. O preço aqui é o sugerido; em cada venda dá para mudar." />

      <details className="cartao mb-6">
        <summary className="cursor-pointer font-titulos text-lg font-bold text-marinho">+ Novo produto</summary>
        <ActionForm action={salvarProduto} botao="Cadastrar" className="mt-4">
          <CamposProduto />
        </ActionForm>
      </details>

      <ul className="space-y-3">
        {produtos.map((p) => (
          <li key={p.id} className={`cartao p-4 ${p.ativo ? "" : "opacity-60"}`}>
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-3">
                {p.imagemId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo painel
                  <img src={urlImagem(p.imagemId)!} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amarelo-claro text-2xl" aria-hidden>{p.emoji || "🍽️"}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{p.nome}{!p.ativo && <span className="ml-2 text-xs font-semibold text-stone-500">fora do cardápio</span>}</span>
                  {p.descricao && <span className="block truncate text-sm text-stone-500">{p.descricao}</span>}
                </span>
                <span className="font-titulos text-lg font-bold text-marinho">{moeda(p.preco)}</span>
              </summary>
              <ActionForm action={salvarProduto} className="mt-4 border-t border-[#f1ebe1] pt-4">
                <CamposProduto p={p} />
              </ActionForm>
              <form action={alternarProduto} className="mt-3">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="ativo" value={String(!p.ativo)} />
                <button className={p.ativo ? "botao-perigo" : "botao-sec"}>{p.ativo ? "Tirar do cardápio" : "Voltar ao cardápio"}</button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
