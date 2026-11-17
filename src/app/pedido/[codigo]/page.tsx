import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getDb } from "@/db";
import { lerConfiguracao, pixDoPedido, urlDoSite } from "@/lib/config";
import { ROTULO_ESTADO, ROTULO_MEIO, estadoPedido, linkWhatsApp } from "@/lib/dominio";
import { dataExtenso, moeda } from "@/lib/formato";
import { pedidoPorCodigo, vendaPorId } from "@/lib/vendas";
import { caixaDaVenda } from "@/lib/caixa";
import { AutoAtualizar } from "@/components/auto-atualizar";
import { IconeCheck, IconeWhatsApp } from "@/components/icones";
import { Logo } from "@/components/marca";
import { Rodape } from "../../rodape";
import { Copiar } from "./copiar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu pedido", robots: { index: false } };

const COR_ESTADO = {
  a_pagar: "bg-amarelo-claro text-amber-900",
  pago: "bg-green-100 text-green-800",
  entregue: "bg-marinho-claro text-marinho",
  cancelado: "bg-red-100 text-red-700",
} as const;

export default async function PedidoPage({ params }: PageProps<"/pedido/[codigo]">) {
  const { codigo } = await params;
  const db = await getDb();
  const pedido = await pedidoPorCodigo(db, codigo);
  if (!pedido) notFound();
  const [venda, config] = await Promise.all([vendaPorId(db, pedido.vendaId), lerConfiguracao(db)]);
  if (!venda) notFound();

  const estado = estadoPedido(pedido);
  const mostrarPix = estado === "a_pagar" && pedido.pagarQuando === "pix_agora";
  const pix = mostrarPix ? pixDoPedido(config, pedido) : null;
  const qr = pix ? await QRCode.toDataURL(pix, { margin: 1, width: 560, color: { dark: "#0f2747", light: "#ffffff" } }) : null;
  const link = `${urlDoSite()}/pedido/${pedido.codigo}`;
  const caixa = await caixaDaVenda(db, venda, config);
  const whatsapp = caixa.whatsapp
    ? linkWhatsApp(
        caixa.whatsapp,
        mostrarPix
          ? `Olá! Segue o comprovante do Pix do pedido nº ${pedido.numero} (${pedido.clienteNome}), ${moeda(pedido.total)}.\n${link}`
          : `Olá! Sobre o meu pedido nº ${pedido.numero} (${pedido.clienteNome}): ${link}`,
      )
    : null;

  return (
    <div className="min-h-screen pb-12">
      {estado === "a_pagar" && <AutoAtualizar segundos={30} />}
      <header className="bg-marinho pb-16 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pt-5">
          <Logo nome={config.igreja ?? config.nome} versao={config.logoId} tamanho={40} />
          <Link href="/" className="font-titulos text-lg font-semibold">{config.nome}</Link>
        </div>
      </header>

      <main className="mx-auto -mt-12 max-w-lg space-y-4 px-4">
        <section className="cartao text-center">
          {estado !== "cancelado" && (
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-green-100 text-green-700">
              <IconeCheck width={30} height={30} />
            </span>
          )}
          <p className="mt-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
            {estado === "cancelado" ? "Pedido cancelado" : "Pedido recebido"}
          </p>
          <p className="font-titulos text-6xl leading-none font-bold text-marinho">nº {pedido.numero}</p>
          <p className="mt-2 text-lg font-semibold">{pedido.clienteNome}</p>
          <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-bold ${COR_ESTADO[estado]}`}>
            {ROTULO_ESTADO[estado]}
            {pedido.pagoCom && estado !== "cancelado" ? ` (${ROTULO_MEIO[pedido.pagoCom]})` : ""}
          </span>
          {estado !== "cancelado" && estado !== "entregue" && (
            <p className="mx-auto mt-4 max-w-xs text-sm text-stone-600">
              Retire <strong>{dataExtenso(venda.dataRetirada)}</strong>
              {venda.retirada ? `, ${venda.retirada.charAt(0).toLowerCase()}${venda.retirada.slice(1)}` : ""}. Fale o número do pedido na cantina.
            </p>
          )}
        </section>

        {mostrarPix && (
          <section className="cartao text-center">
            <h2 className="font-titulos text-2xl font-bold text-marinho">Pague com Pix</h2>
            {pix && qr ? (
              <>
                <p className="mt-1 text-sm text-stone-600">
                  Valor: <strong className="text-tinta">{moeda(pedido.total)}</strong>
                  {config.pixNome && <> · para <strong className="text-tinta">{config.pixNome}</strong></>}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR code gerado no servidor */}
                <img src={qr} alt="QR code do Pix" className="mx-auto mt-4 aspect-square w-56 rounded-xl border border-[#ece4d8]" />
                <p className="mt-4 text-sm text-stone-600">No celular, copie o código e cole na opção <strong>Pix Copia e Cola</strong> do seu banco:</p>
                <Copiar texto={pix} />
                <p className="mt-4 rounded-xl bg-amarelo-claro px-4 py-3 text-left text-sm text-amber-950">
                  Depois de pagar, envie o comprovante pelo WhatsApp. A equipe confere e marca o seu pedido como pago.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-stone-600">O Pix ainda não foi configurado. Pague na retirada, por favor.</p>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 py-3 font-bold text-white hover:bg-[#178a45]">
                <IconeWhatsApp /> Enviar comprovante{caixa.nome ? ` para ${caixa.nome.split(" ")[0]}` : ""}
              </a>
            )}
          </section>
        )}

        <section className="cartao">
          <h2 className="font-titulos text-xl font-bold text-marinho">Itens</h2>
          <ul className="mt-2 divide-y divide-[#f1ebe1]">
            {pedido.itens.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2.5">
                <span><strong>{i.quantidade}×</strong> {i.nome}</span>
                <span className="text-stone-600">{moeda(i.total)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-[#ece4d8] pt-3 text-lg font-bold">
            <span>Total</span>
            <span className="text-marinho">{moeda(pedido.total)}</span>
          </p>
          {pedido.observacao && <p className="mt-3 text-sm text-stone-500">Obs.: {pedido.observacao}</p>}
          {estado === "a_pagar" && pedido.pagarQuando === "na_retirada" && (
            <p className="mt-3 rounded-xl bg-marinho-claro px-4 py-3 text-sm text-marinho">Pagamento na retirada: Pix ou dinheiro.</p>
          )}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="botao-sec flex-1">Fazer outro pedido</Link>
          {whatsapp && !mostrarPix && (
            <a href={whatsapp} target="_blank" rel="noopener" className="botao-sec flex-1">
              <IconeWhatsApp className="text-[#1fa855]" /> Falar com a cantina
            </a>
          )}
        </div>
      </main>

      <Rodape config={config} />
    </div>
  );
}
