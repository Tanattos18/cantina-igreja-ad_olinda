import type { MeioRecebimento, PagarQuando, TipoChavePix } from "@/db/schema";

export const QTD_MAX_POR_ITEM = 50;
export const MAX_ITENS_PEDIDO = 30;

export const ROTULO_PAGAR: Record<PagarQuando, string> = {
  pix_agora: "Pix pelo site",
  na_retirada: "Pagar na retirada",
};

export const ROTULO_MEIO: Record<MeioRecebimento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
};

export const ROTULO_CHAVE: Record<TipoChavePix, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  telefone: "Celular",
  email: "E-mail",
  aleatoria: "Chave aleatória",
};

export type EstadoPedido = "cancelado" | "entregue" | "pago" | "a_pagar";

export function estadoPedido(p: { canceladoEm: Date | null; entregueEm: Date | null; pagoEm: Date | null }): EstadoPedido {
  if (p.canceladoEm) return "cancelado";
  if (p.entregueEm) return "entregue";
  if (p.pagoEm) return "pago";
  return "a_pagar";
}

export const ROTULO_ESTADO: Record<EstadoPedido, string> = {
  a_pagar: "A pagar",
  pago: "Pago · aguardando retirada",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Quantas unidades ainda podem ser pedidas. null = sem limite. */
export function restante(limite: number | null, reservado: number): number | null {
  return limite == null ? null : Math.max(0, limite - reservado);
}

/** "(81) 99999-0000", "81999990000" → "5581999990000". Vazio se não parecer um telefone brasileiro. */
export function normalizarTelefone(bruto: string): string {
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return "";
  return `55${d}`;
}

/** "5581999990000" → "(81) 99999-0000" */
export function telefoneBR(normalizado: string | null | undefined): string {
  if (!normalizado) return "";
  const d = normalizado.replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return normalizado;
}

export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Identificador do Pix no extrato: venda e número do pedido (ex.: "CANTINA3P15"). */
export function identificadorPix(vendaId: number, numero: number): string {
  return `CANTINA${vendaId}P${numero}`;
}
