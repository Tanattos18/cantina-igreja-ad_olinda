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
  const titulo = `${c.nome} — Faça seu pedido`;
  const descricao = `${c.mensagem ? `${c.mensagem}. ` : ""}Peça pelo celular, pague no Pix ou na retirada e pegue sem fila.`;
  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao, siteName: c.nome, locale: "pt_BR", type: "website", url: "/" },
  };
}

export default async function Inicio() {
  const db = await getDb();
  const [config, venda] = await Promise.all([lerConfiguracao(db), vendaAberta(db)]);
  const itens = venda ? (await itensDaVenda(db, venda.id)).filter((i) => i.ativo) : [];
  const aberta = !!venda && aceitaPedidosNoSite(venda);

  return (
    <div className="min-h-screen pb-28 lg:pb-10">
      <header className="relative overflow-hidden bg-marinho text-white">
        <div aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-amarelo/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
          <Logo nome={config.igreja ?? config.nome} versao={config.logoId} tamanho={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-titulos text-2xl leading-tight font-bold sm:text-3xl">{config.nome}</h1>
            {config.mensagem && <p className="truncate text-sm text-blue-100/80">{config.mensagem}</p>}
          </div>
        </div>
        {venda && (
          <div className="relative bg-amarelo text-marinho">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-2.5">
              <p className="font-titulos text-lg font-bold">{venda.titulo}</p>
              <p className="text-sm font-semibold">
                📍 Retirada {dataExtenso(venda.dataRetirada)}
                {venda.retirada && `, ${venda.retirada}`}
                {venda.encerraEm && aberta && <span className="opacity-75"> · pedidos até {dataHoraBR(venda.encerraEm)}</span>}
              </p>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 lg:pt-6">
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
    <div className="cartao mx-auto mt-6 max-w-xl text-center">
      <p className="text-5xl" aria-hidden>🍽️</p>
      <h2 className="mt-2 font-titulos text-2xl font-bold text-marinho">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-sm text-stone-600">{texto}</p>
    </div>
  );
}
