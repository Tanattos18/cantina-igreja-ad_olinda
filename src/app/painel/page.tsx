import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { vendaAberta } from "@/lib/vendas";

/** Entrada do painel: os pedidos da venda aberta, ou a lista de vendas. */
export default async function Painel() {
  await exigirUsuario();
  const aberta = await vendaAberta(await getDb());
  redirect(aberta ? `/painel/vendas/${aberta.id}` : "/painel/vendas");
}
