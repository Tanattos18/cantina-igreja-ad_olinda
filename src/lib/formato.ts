const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function moeda(valor: number | null | undefined): string {
  return moedaFmt.format(valor ?? 0);
}

/** Arredonda para centavos evitando erros de ponto flutuante (ex.: 0,1 + 0,2). */
export function centavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** "2026-10-05" → "05/10/2026" */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Hoje no fuso de Brasília, no formato AAAA-MM-DD. */
export function hojeISO(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function competenciaAtual(): string {
  return hojeISO().slice(0, 7);
}

/** "2026-10" → { inicio: "2026-10-01", fim: "2026-10-31" } */
export function periodoDaCompetencia(competencia: string): { inicio: string; fim: string } {
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error(`Competência inválida: ${competencia}`);
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { inicio: `${competencia}-01`, fim: `${competencia}-${String(ultimoDia).padStart(2, "0")}` };
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-10" → "Outubro/2026" */
export function competenciaExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

/** Primeiro dia do mês anterior: "2026-03-15" → "2026-02-01" */
export function inicioMesAnterior(iso: string): string {
  return `${somarDias(`${iso.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
}

/** Soma dias a uma data AAAA-MM-DD. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES_MIN = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11-23" → "domingo, 23 de novembro" */
export function dataExtenso(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES_MIN[d.getUTCMonth()]}`;
}

/** Data e hora em Brasília: "sáb., 22/11 às 20:00" */
export function dataHoraBR(d: Date): string {
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}/${p.month} às ${p.hour}:${p.minute}`;
}

/** Só a hora em Brasília: "19:42" */
export function horaBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** "2026-11-22T20:00" digitado no painel (horário de Brasília) → Date. */
export function deDataHoraLocal(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  return new Date(`${valor}:00-03:00`);
}

/** Date → "2026-11-22T20:00" no horário de Brasília (para o campo datetime-local). */
export function paraDataHoraLocal(d: Date | null): string {
  if (!d) return "";
  const local = new Date(d.getTime() - 3 * 3600_000);
  return local.toISOString().slice(0, 16);
}

/** Próximo domingo (ou hoje, se for domingo), no formato AAAA-MM-DD: o dia de cantina. */
export function proximoDomingo(agora = new Date()): string {
  const d = new Date(`${hojeISO(agora)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}
