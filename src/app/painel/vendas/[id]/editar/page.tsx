import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { paraDataHoraLocal } from "@/lib/formato";
import { itensDaVenda, vendaPorId } from "@/lib/vendas";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { adicionarItem, reativarItem, removerItem, salvarItem, salvarVenda } from "../../actions";
import { BotaoSituacao } from "../../botao-situacao";
import { SeletorCaixa } from "../../seletor-caixa";
import { lerConfiguracao } from "@/lib/config";

export const metadata = { title: "Editar venda — Painel" };

const valorBR = (v: number) => v.toFixed(2).replace(".", ",");

export default async function EditarVenda({ params }: PageProps<"/painel/vendas/[id]/editar">) {
  await exigirUsuario();
  const id = Number((await params).id);
  const db = await getDb();
  const venda = Number.isInteger(id) ? await vendaPorId(db, id) : undefined;
  if (!venda) notFound();
  const [itens, produtos, config] = await Promise.all([
    itensDaVenda(db, venda.id),
    db.select().from(schema.produtos).where(eq(schema.produtos.ativo, true)).orderBy(asc(schema.produtos.nome)),
    lerConfiguracao(db),
  ]);
  const naVenda = new Set(itens.filter((i) => i.ativo).map((i) => i.produtoId));
  const faltando = produtos.filter((p) => !naVenda.has(p.id));

  return (
    <div className="max-w-3xl">
      <Cabecalho
        titulo="Editar venda"
        descricao={<Link href={`/painel/vendas/${venda.id}`} className="link">← Voltar aos pedidos</Link>}
        acoes={
          <BotaoSituacao vendaId={venda.id} situacao={venda.situacao} grande />
        }
      />
      {venda.situacao !== "aberta" && (
        <p className="mb-4 rounded-xl bg-amarelo-claro px-4 py-3 text-sm text-amber-950">
          A cantina está <strong>fechada</strong> para esta venda: ela não aparece no link. Confira os itens e clique em <strong>🟢 Abrir a cantina</strong>. Se outra venda estiver aberta, ela é fechada.
        </p>
      )}

      <SeletorCaixa vendaId={venda.id} caixaUsuarioId={venda.caixaUsuarioId} reserva={config.whatsapp} />

      <ActionForm action={salvarVenda} className="cartao mb-6" botao="Salvar dados">
        <input type="hidden" name="id" value={venda.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Título" className="sm:col-span-2">
            <input name="titulo" className="campo" required maxLength={80} defaultValue={venda.titulo} />
          </Campo>
          <Campo rotulo="Dia da retirada">
            <input name="dataRetirada" type="date" className="campo" required defaultValue={venda.dataRetirada} />
          </Campo>
          <Campo rotulo="Pedidos pelo site até (vazio = até encerrar)">
            <input name="encerraEm" type="datetime-local" className="campo" defaultValue={paraDataHoraLocal(venda.encerraEm)} />
          </Campo>
          <Campo rotulo="Onde e quando retirar" className="sm:col-span-2">
            <input name="retirada" className="campo" maxLength={150} defaultValue={venda.retirada ?? ""} />
          </Campo>
        </div>
      </ActionForm>

      <h2 className="font-titulos text-xl font-bold text-marinho">Itens da venda</h2>
      <p className="mb-3 text-sm text-stone-500">
        Preço do dia e quantas unidades foram produzidas. Quando acabar, a loja mostra <strong>Esgotado</strong>. Deixe a quantidade vazia para não limitar.
      </p>
      <ul className="space-y-3">
        {itens.map((i) => (
          <li key={i.id} className={`cartao p-4 ${i.ativo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-end gap-3">
              <p className="w-full font-bold sm:w-auto sm:flex-1">
                <span className="mr-1" aria-hidden>{i.emoji}</span>
                {i.nome}
                <span className="ml-2 text-xs font-normal text-stone-500">{i.reservado} pedidos</span>
                {!i.ativo && <span className="ml-2 text-xs font-semibold text-red-700">fora da loja</span>}
              </p>
              {i.ativo ? (
                <>
                  <ActionForm action={salvarItem} botao="Salvar" botaoClasse="botao-sec" className="flex flex-wrap items-end gap-3 [&>div]:mt-0">
                    <input type="hidden" name="id" value={i.id} />
                    <Campo rotulo="Preço (R$)" className="w-28">
                      <input name="preco" className="campo" inputMode="decimal" required defaultValue={valorBR(i.preco)} />
                    </Campo>
                    <Campo rotulo="Produzido" className="w-28">
                      <input name="limite" type="number" min={0} className="campo" placeholder="sem limite" defaultValue={i.limite ?? ""} />
                    </Campo>
                  </ActionForm>
                  <form action={removerItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="botao-perigo" aria-label={`Tirar ${i.nome} da venda`}>Tirar</button>
                  </form>
                </>
              ) : (
                <form action={reativarItem}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="botao-sec">Voltar para a loja</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      {faltando.length > 0 && (
        <ActionForm action={adicionarItem} botao="Adicionar" className="cartao mt-4 flex flex-wrap items-end gap-3 [&>div]:mt-0">
          <input type="hidden" name="vendaId" value={venda.id} />
          <Campo rotulo="Adicionar item do cardápio" className="min-w-56 flex-1">
            <select name="produtoId" className="campo">
              {faltando.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji} {p.nome}</option>
              ))}
            </select>
          </Campo>
        </ActionForm>
      )}
      <p className="mt-4 text-sm text-stone-500">
        Precisa de um item novo? Cadastre no <Link href="/painel/produtos" className="link">Cardápio</Link> e depois adicione aqui.
      </p>
    </div>
  );
}
