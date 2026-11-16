import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, max, sql, sum } from "drizzle-orm";
import { schema, type DB } from "@/db";
import type { MeioRecebimento, PagarQuando } from "@/db/schema";
import { centavos } from "./formato";
import { urlImagem } from "./imagens";
import { calcularPedido, type ItemDaVenda, type ItemEscolhido } from "./pedido";

type Leitor = Pick<DB, "select">;

export type Venda = typeof schema.vendas.$inferSelect;
export type Pedido = typeof schema.pedidos.$inferSelect;
export type PedidoComItens = Pedido & { itens: (typeof schema.pedidoItens.$inferSelect)[] };

export type ItemVitrine = ItemDaVenda & {
  produtoId: number;
  descricao: string | null;
  emoji: string | null;
  imagemUrl: string | null;
};

/** A venda que o link da loja mostra: a aberta mais recente. */
export async function vendaAberta(db: Leitor): Promise<Venda | undefined> {
  const [v] = await db
    .select()
    .from(schema.vendas)
    .where(eq(schema.vendas.situacao, "aberta"))
    .orderBy(desc(schema.vendas.dataRetirada), desc(schema.vendas.id))
    .limit(1);
  return v;
}

export async function vendaPorId(db: Leitor, id: number): Promise<Venda | undefined> {
  const [v] = await db.select().from(schema.vendas).where(eq(schema.vendas.id, id));
  return v;
}

/** O site aceita pedidos só com a venda aberta e antes do horário de encerramento. */
export function aceitaPedidosNoSite(v: Venda, agora = new Date()): boolean {
  return v.situacao === "aberta" && (v.encerraEm == null || v.encerraEm > agora);
}

/** Produtos da venda com o preço do dia e quantas unidades já foram pedidas. */
export async function itensDaVenda(db: Leitor, vendaId: number): Promise<ItemVitrine[]> {
  const VI = schema.vendaItens;
  const PI = schema.pedidoItens;
  const P = schema.pedidos;
  const [itens, reservas] = await Promise.all([
    db
      .select({
        id: VI.id,
        produtoId: VI.produtoId,
        preco: VI.preco,
        limite: VI.limite,
        ativo: VI.ativo,
        nome: schema.produtos.nome,
        descricao: schema.produtos.descricao,
        emoji: schema.produtos.emoji,
        imagemId: schema.produtos.imagemId,
      })
      .from(VI)
      .innerJoin(schema.produtos, eq(schema.produtos.id, VI.produtoId))
      .where(eq(VI.vendaId, vendaId))
      .orderBy(asc(VI.id)),
    db
      .select({ vendaItemId: PI.vendaItemId, qtd: sum(PI.quantidade).mapWith(Number) })
      .from(PI)
      .innerJoin(P, eq(P.id, PI.pedidoId))
      .where(and(eq(P.vendaId, vendaId), isNull(P.canceladoEm)))
      .groupBy(PI.vendaItemId),
  ]);
  const reservado = new Map(reservas.map((r) => [r.vendaItemId, r.qtd ?? 0]));
  return itens.map(({ imagemId, ...i }) => ({ ...i, imagemUrl: urlImagem(imagemId), reservado: reservado.get(i.id) ?? 0 }));
}

export async function pedidosDaVenda(db: Leitor, vendaId: number): Promise<PedidoComItens[]> {
  const pedidos = await db.select().from(schema.pedidos).where(eq(schema.pedidos.vendaId, vendaId)).orderBy(desc(schema.pedidos.numero));
  if (!pedidos.length) return [];
  const itens = await db
    .select()
    .from(schema.pedidoItens)
    .where(inArray(schema.pedidoItens.pedidoId, pedidos.map((p) => p.id)))
    .orderBy(asc(schema.pedidoItens.id));
  const porPedido = new Map<number, PedidoComItens["itens"]>();
  for (const i of itens) porPedido.set(i.pedidoId, [...(porPedido.get(i.pedidoId) ?? []), i]);
  return pedidos.map((p) => ({ ...p, itens: porPedido.get(p.id) ?? [] }));
}

export async function pedidoPorCodigo(db: Leitor, codigo: string): Promise<PedidoComItens | undefined> {
  const [p] = await db.select().from(schema.pedidos).where(eq(schema.pedidos.codigo, codigo));
  if (!p) return undefined;
  const itens = await db.select().from(schema.pedidoItens).where(eq(schema.pedidoItens.pedidoId, p.id)).orderBy(asc(schema.pedidoItens.id));
  return { ...p, itens };
}

export type Resumo = {
  pedidos: number;
  vendido: number;
  recebido: number;
  recebidoPor: Record<MeioRecebimento, number>;
  aReceber: number;
  entregues: number;
  aguardandoRetirada: number;
  cancelados: number;
};

/** Números de uma venda: o que foi vendido, o que já entrou (e como) e o que falta receber. */
export function resumir(pedidos: Pedido[]): Resumo {
  const r: Resumo = {
    pedidos: 0,
    vendido: 0,
    recebido: 0,
    recebidoPor: { pix: 0, dinheiro: 0, cartao: 0 },
    aReceber: 0,
    entregues: 0,
    aguardandoRetirada: 0,
    cancelados: 0,
  };
  for (const p of pedidos) {
    if (p.canceladoEm) {
      r.cancelados++;
      continue;
    }
    r.pedidos++;
    r.vendido += p.total;
    if (p.pagoEm && p.pagoCom) {
      r.recebido += p.total;
      r.recebidoPor[p.pagoCom] += p.total;
    } else {
      r.aReceber += p.total;
    }
    if (p.entregueEm) r.entregues++;
    else r.aguardandoRetirada++;
  }
  r.vendido = centavos(r.vendido);
  r.recebido = centavos(r.recebido);
  r.aReceber = centavos(r.aReceber);
  for (const m of Object.keys(r.recebidoPor) as MeioRecebimento[]) r.recebidoPor[m] = centavos(r.recebidoPor[m]);
  return r;
}

export type NovoPedido = {
  vendaId: number;
  origem: "site" | "balcao";
  clienteNome: string;
  clienteTelefone: string | null;
  observacao: string | null;
  pagarQuando: PagarQuando;
  itens: ItemEscolhido[];
  /** Venda no balcão: já paga e entregue na hora. */
  pagoCom?: MeioRecebimento;
  entregue?: boolean;
  usuarioId?: number;
};

export type ResultadoPedido = { erro: string } | { id: number; numero: number; codigo: string; total: number };

/**
 * Grava o pedido conferindo, com a venda travada, se ainda há unidades de cada item.
 * Dois pedidos ao mesmo tempo nunca vendem a mesma última pamonha nem pegam o mesmo número.
 */
export async function registrarPedido(db: DB, novo: NovoPedido, agora = new Date()): Promise<ResultadoPedido> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from vendas where id = ${novo.vendaId} for update`);
    const venda = await vendaPorId(tx, novo.vendaId);
    if (!venda || venda.situacao !== "aberta") return { erro: "Esta venda não está aberta." };
    if (novo.origem === "site" && !aceitaPedidosNoSite(venda, agora)) {
      return { erro: "Os pedidos pelo site já foram encerrados para esta venda." };
    }

    const itens = await itensDaVenda(tx, venda.id);
    const calc = calcularPedido(novo.itens, new Map(itens.map((i) => [i.id, i])));
    if (typeof calc === "string") return { erro: calc };

    const [{ ultimo }] = await tx
      .select({ ultimo: max(schema.pedidos.numero) })
      .from(schema.pedidos)
      .where(eq(schema.pedidos.vendaId, venda.id));
    const numero = (ultimo ?? 0) + 1;
    const codigo = randomBytes(12).toString("base64url");
    const [pedido] = await tx
      .insert(schema.pedidos)
      .values({
        vendaId: venda.id,
        numero,
        codigo,
        origem: novo.origem,
        clienteNome: novo.clienteNome,
        clienteTelefone: novo.clienteTelefone,
        observacao: novo.observacao,
        pagarQuando: novo.pagarQuando,
        total: calc.total,
        pagoEm: novo.pagoCom ? agora : null,
        pagoCom: novo.pagoCom ?? null,
        entregueEm: novo.entregue ? agora : null,
        usuarioId: novo.usuarioId ?? null,
        criadoEm: agora,
      })
      .returning({ id: schema.pedidos.id });
    await tx.insert(schema.pedidoItens).values(calc.itens.map((i) => ({ ...i, pedidoId: pedido.id })));
    return { id: pedido.id, numero, codigo, total: calc.total };
  });
}
