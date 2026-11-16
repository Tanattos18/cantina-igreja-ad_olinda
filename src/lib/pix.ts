import type { TipoChavePix } from "@/db/schema";

/**
 * Pix "copia e cola" estático com valor (padrão BR Code do Banco Central).
 * Não passa por banco nem intermediário: o dinheiro cai direto na chave da igreja, sem taxa.
 * A confirmação do pagamento é feita pela equipe (comprovante no WhatsApp ou extrato).
 */

function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do código. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Nome e cidade só aceitam letras sem acento, números e espaço. */
function limpar(texto: string, max: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

/** Deixa a chave no formato que o Pix espera. Vazio se a chave não for válida para o tipo. */
export function normalizarChave(tipo: TipoChavePix, bruta: string): string {
  const s = bruta.trim();
  const digitos = s.replace(/\D/g, "");
  switch (tipo) {
    case "cpf":
      return digitos.length === 11 ? digitos : "";
    case "cnpj":
      return digitos.length === 14 ? digitos : "";
    case "telefone": {
      const d = digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
      return d.length === 10 || d.length === 11 ? `+55${d}` : "";
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : "";
    case "aleatoria":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s.toLowerCase() : "";
  }
}

export type DadosPix = {
  chave: string;
  nome: string;
  cidade: string;
  valor?: number;
  /** Identificador que aparece no extrato (até 25 letras/números). */
  identificador?: string;
  descricao?: string;
};

export function gerarPixCopiaECola(d: DadosPix): string {
  const conta =
    campo("00", "br.gov.bcb.pix") +
    campo("01", d.chave) +
    (d.descricao ? campo("02", limpar(d.descricao, 40)) : "");
  const txid = (d.identificador ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (d.valor != null && d.valor > 0 ? campo("54", d.valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpar(d.nome, 25) || "CANTINA") +
    campo("60", limpar(d.cidade, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";
  return corpo + crc16(corpo);
}
