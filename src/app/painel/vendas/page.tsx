import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { dataExtenso, hojeISO, moeda } from "@/lib/formato";
import { resumir } from "@/lib/vendas";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { criarVenda } from "./actions";

export const metadata = { title: "Vendas — Painel" };

/** Próximo domingo (ou hoje, se for domingo): o dia mais comum de venda da cantina. */
function proximoDomingo(): string {
  const hoje = new Date(`${hojeISO()}T12:00:00Z`);
  hoje.setUTCDate(hoje.getUTCDate() + ((7 - hoje.getUTCDay()) % 7));
  return hoje.toISOString().slice(0, 10);
}

export default async function VendasPage() {
  await exigirUsuario();
  const db = await getDb();
  const [vendas, pedidos] = await Promise.all([
    db.select().from(schema.vendas).orderBy(desc(schema.vendas.dataRetirada), desc(schema.vendas.id)).limit(100),
    db.select().from(schema.pedidos),
  ]);
  const porVenda = new Map<number, (typeof pedidos)[number][]>();
  for (const p of pedidos) porVenda.set(p.vendaId, [...(porVenda.get(p.vendaId) ?? []), p]);
  const geral = resumir(pedidos);

  return (
    <div className="max-w-4xl">
      <Cabecalho titulo="Vendas" descricao="Cada venda é um dia da cantina, com o seu cardápio e as quantidades produzidas." />

      <details className="cartao mb-6" open={vendas.length === 0}>
        <summary className="cursor-pointer font-titulos text-lg font-bold text-marinho">+ Nova venda</summary>
        <ActionForm action={criarVenda} botao="Criar venda" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Título" className="sm:col-span-2">
              <input name="titulo" className="campo" required maxLength={80} defaultValue="Domingo é dia de cantina!" />
            </Campo>
            <Campo rotulo="Dia da retirada">
              <input name="dataRetirada" type="date" className="campo" required defaultValue={proximoDomingo()} />
            </Campo>
            <Campo rotulo="Pedidos pelo site até (opcional)">
              <input name="encerraEm" type="datetime-local" className="campo" />
            </Campo>
            <Campo rotulo="Onde e quando retirar" className="sm:col-span-2">
              <input name="retirada" className="campo" maxLength={150} defaultValue="na cantina, após o culto" />
            </Campo>
          </div>
          <p className="mt-3 text-sm text-stone-500">A venda começa com todos os itens do cardápio. Na próxima tela você ajusta preços e quantidades.</p>
        </ActionForm>
      </details>

      {pedidos.length > 0 && (
        <p className="mb-3 text-sm text-stone-600">
          Desde o início: <strong>{moeda(geral.vendido)}</strong> vendidos em {geral.pedidos} pedidos.
        </p>
      )}

      <ul className="space-y-3">
        {vendas.map((v) => {
          const r = resumir(porVenda.get(v.id) ?? []);
          return (
            <li key={v.id}>
              <Link href={`/painel/vendas/${v.id}`} className="cartao flex flex-wrap items-center gap-4 p-4 transition hover:border-marinho/40">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {v.titulo}{" "}
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${v.situacao === "aberta" ? "bg-green-100 text-green-800" : v.situacao === "rascunho" ? "bg-stone-200 text-stone-700" : "bg-marinho-claro text-marinho"}`}>
                      {v.situacao === "aberta" ? "Aberta" : v.situacao === "rascunho" ? "Rascunho" : "Encerrada"}
                    </span>
                  </p>
                  <p className="text-sm text-stone-500">{dataExtenso(v.dataRetirada)} · {r.pedidos} pedidos</p>
                </div>
                <div className="text-right">
                  <p className="font-titulos text-xl font-bold text-marinho">{moeda(r.vendido)}</p>
                  {r.aReceber > 0 && <p className="text-xs font-semibold text-amber-800">{moeda(r.aReceber)} a receber</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
