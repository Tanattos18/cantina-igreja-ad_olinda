import type { MetadataRoute } from "next";
import { getDb } from "@/db";
import { lerConfiguracao } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Permite "Adicionar à tela inicial": abre a cantina como um aplicativo. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const c = await lerConfiguracao(await getDb());
  return {
    id: "/",
    name: c.nome,
    short_name: c.nome.split(" ").slice(0, 2).join(" "),
    description: c.mensagem ?? "Faça seu pedido na cantina",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf6ef",
    theme_color: "#0f2747",
    lang: "pt-BR",
    icons: [{ src: `/logo?v=${c.logoId ?? 0}`, sizes: "any", purpose: "any" }],
  };
}
