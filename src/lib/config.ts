import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { identificadorPix } from "./dominio";
import { gerarPixCopiaECola } from "./pix";

export type Configuracao = typeof schema.configuracao.$inferSelect;

const PADRAO: Configuracao = {
  id: 1,
  nome: "Cantina",
  igreja: null,
  mensagem: null,
  endereco: null,
  cultos: null,
  instagram: null,
  whatsapp: null,
  pixTipo: null,
  pixChave: null,
  pixNome: null,
  pixCidade: null,
  logoId: null,
};

export async function lerConfiguracao(db: Pick<DB, "select">): Promise<Configuracao> {
  const [c] = await db.select().from(schema.configuracao).where(eq(schema.configuracao.id, 1));
  return c ?? PADRAO;
}

/** Pix pelo site só aparece com chave, nome e cidade preenchidos. */
export function pixConfigurado(c: Configuracao): boolean {
  return !!(c.pixChave && c.pixNome && c.pixCidade);
}

export function pixDoPedido(c: Configuracao, p: { vendaId: number; numero: number; total: number }): string | null {
  if (!pixConfigurado(c)) return null;
  return gerarPixCopiaECola({
    chave: c.pixChave!,
    nome: c.pixNome!,
    cidade: c.pixCidade!,
    valor: p.total,
    identificador: identificadorPix(p.vendaId, p.numero),
  });
}

/** Endereço público do site, para o link de compartilhar. */
export function urlDoSite(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.SITE_URL ?? (vercel ? `https://${vercel}` : "http://localhost:3030")).replace(/\/$/, "");
}
