import { getDb } from "@/db";
import { lerConfiguracao, pixConfigurado } from "@/lib/config";
import { dataExtenso, dataHoraBR } from "@/lib/formato";
import { aceitaPedidosNoSite, itensDaVenda, vendaAberta } from "@/lib/vendas";
import { Logo } from "@/components/marca";
import { Loja } from "./loja";
import { Rodape } from "./rodape";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await lerConfiguracao(await getDb());
  return { title: `${c.nome} — Faça seu pedido`, description: c.mensagem ?? "Faça seu pedido na cantina" };
}

export default async function Inicio() {
  const db = await getDb();
  const [config, venda] = await Promise.all([lerConfiguracao(db), vendaAberta(db)]);
  const itens = venda ? (await itensDaVenda(db, venda.id)).filter((i) => i.ativo) : [];
  const aberta = !!venda && aceitaPedidosNoSite(venda);

  return (
    <div className="min-h-screen pb-28">
      <header className="relative overflow-hidden bg-marinho text-white">
        <div aria-hidden className="absolute -top-24 -right-20 size-72 rounded-full bg-amarelo/15 blur-2xl" />
        <div aria-hidden className="absolute -bottom-28 -left-16 size-64 rounded-full bg-amarelo/10 blur-2xl" />
        <div className="relative mx-auto max-w-2xl px-4 pt-6 pb-10 sm:pt-8">
          <div className="flex items-center gap-3">
            <Logo nome={config.igreja ?? config.nome} versao={config.logoId} tamanho={52} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold tracking-[0.18em] text-amarelo uppercase">{config.igreja ?? "Cantina"}</p>
              {config.mensagem && <p className="truncate text-sm text-blue-100/80">{config.mensagem}</p>}
            </div>
          </div>

          <h1 className="mt-7 font-titulos text-4xl leading-tight font-bold sm:text-5xl">{config.nome}</h1>
          {venda ? (
            <div className="mt-4 space-y-1.5">
              <p className="inline-flex items-center gap-2 rounded-full bg-amarelo px-3 py-1 text-sm font-bold text-marinho">
                {venda.titulo}
              </p>
              <p className="text-blue-50">
                Retirada <strong className="font-bold">{dataExtenso(venda.dataRetirada)}</strong>
                {venda.retirada && <span className="text-blue-100/80"> · {venda.retirada}</span>}
              </p>
              {venda.encerraEm && aberta && (
                <p className="text-sm text-blue-100/80">Pedidos até {dataHoraBR(venda.encerraEm)}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 max-w-md text-blue-100/90">Faça seu pedido pelo celular e retire na cantina, sem fila.</p>
          )}
        </div>
      </header>

      <main className="relative mx-auto -mt-5 max-w-2xl px-4">
        {!venda ? (
          <Aviso titulo="Nenhuma venda aberta agora" texto="Assim que a próxima venda da cantina for aberta, o cardápio aparece aqui. Fique de olho nos avisos da igreja!" />
        ) : !aberta ? (
          <Aviso titulo="Pedidos pelo site encerrados" texto="Os pedidos antecipados desta venda já fecharam. Você ainda pode comprar direto na cantina, enquanto durar." />
        ) : itens.length === 0 ? (
          <Aviso titulo="Cardápio em preparação" texto="Os itens desta venda ainda estão sendo cadastrados. Volte daqui a pouco." />
        ) : (
          <Loja vendaId={venda.id} itens={itens} pixDisponivel={pixConfigurado(config)} />
        )}
      </main>

      <Rodape config={config} />
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="cartao text-center">
      <p className="text-4xl" aria-hidden>🍽️</p>
      <h2 className="mt-2 font-titulos text-2xl font-bold text-marinho">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-sm text-stone-600">{texto}</p>
    </div>
  );
}
