import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { itensDaVenda, vendaPorId } from "@/lib/vendas";
import { Cabecalho } from "@/components/ui";
import { Caixa } from "./caixa";

export const metadata = { title: "Venda no balcão — Painel" };

export default async function BalcaoPage({ params }: PageProps<"/painel/vendas/[id]/balcao">) {
  await exigirUsuario();
  const id = Number((await params).id);
  const db = await getDb();
  const venda = Number.isInteger(id) ? await vendaPorId(db, id) : undefined;
  if (!venda) notFound();
  const itens = (await itensDaVenda(db, venda.id)).filter((i) => i.ativo);

  return (
    <div className="max-w-4xl">
      <Cabecalho
        titulo="Venda no balcão"
        descricao={<>{venda.titulo} · <Link href={`/painel/vendas/${venda.id}`} className="link">ver pedidos</Link></>}
      />
      {venda.situacao !== "aberta" ? (
        <p className="cartao text-stone-600">Esta venda não está aberta. Abra a venda em <Link href={`/painel/vendas/${venda.id}/editar`} className="link">Editar venda</Link> para registrar vendas no balcão.</p>
      ) : (
        <Caixa vendaId={venda.id} itens={itens} />
      )}
    </div>
  );
}
