import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { bancoDeTeste } from "./test-db";
import { calcularPedido } from "./pedido";
import { itensDaVenda, pedidosDaVenda, registrarPedido, resumir } from "./vendas";

describe("cálculo do pedido", () => {
  const venda = new Map([
    [1, { id: 1, nome: "Pamonha", preco: 8, limite: 10, reservado: 8, ativo: true }],
    [2, { id: 2, nome: "Esfiha", preco: 5.5, limite: null, reservado: 0, ativo: true }],
  ]);

  it("soma linhas repetidas e recalcula o preço", () => {
    const r = calcularPedido([{ vendaItemId: 2, quantidade: 2 }, { vendaItemId: 2, quantidade: 1 }, { vendaItemId: 1, quantidade: 2 }], venda);
    expect(r).toEqual({
      itens: [
        { vendaItemId: 2, nome: "Esfiha", quantidade: 3, precoUnitario: 5.5, total: 16.5 },
        { vendaItemId: 1, nome: "Pamonha", quantidade: 2, precoUnitario: 8, total: 16 },
      ],
      total: 32.5,
    });
  });

  it("não deixa pedir mais do que resta", () => {
    expect(calcularPedido([{ vendaItemId: 1, quantidade: 3 }], venda)).toBe('"Pamonha": só restam 2. Ajuste a quantidade.');
  });

  it("recusa pedido vazio, item desconhecido e quantidade quebrada", () => {
    expect(calcularPedido([], venda)).toMatch(/pelo menos um item/);
    expect(calcularPedido([{ vendaItemId: 9, quantidade: 1 }], venda)).toMatch(/não está mais à venda/);
    expect(calcularPedido([{ vendaItemId: 2, quantidade: 1.5 }], venda)).toMatch(/quantidade inválida/);
  });
});

describe("registro de pedidos", () => {
  let db: DB;
  let vendaId: number;
  let pamonha: number;

  beforeAll(async () => {
    db = await bancoDeTeste("cantina_vendas");
    const [p] = await db.insert(schema.produtos).values({ nome: "Pamonha", preco: 8, emoji: "🌽" }).returning();
    const [v] = await db.insert(schema.vendas).values({ titulo: "Domingo", dataRetirada: "2026-11-22", situacao: "aberta" }).returning();
    vendaId = v.id;
    const [vi] = await db.insert(schema.vendaItens).values({ vendaId, produtoId: p.id, preco: 8, limite: 5 }).returning();
    pamonha = vi.id;
  });

  const pedir = (quantidade: number, extra: Partial<Parameters<typeof registrarPedido>[1]> = {}) =>
    registrarPedido(db, {
      vendaId,
      origem: "site",
      clienteNome: "Maria",
      clienteTelefone: "5581999990000",
      observacao: null,
      pagarQuando: "na_retirada",
      itens: [{ vendaItemId: pamonha, quantidade }],
      ...extra,
    });

  it("numera os pedidos e para de vender quando acaba", async () => {
    const resultados = await Promise.all([pedir(2), pedir(2), pedir(2)]);
    const ok = resultados.filter((r) => "numero" in r);
    expect(ok).toHaveLength(2);
    expect(ok.map((r) => ("numero" in r ? r.numero : 0)).sort()).toEqual([1, 2]);
    expect(resultados.find((r) => "erro" in r)).toEqual({ erro: '"Pamonha": só restam 1. Ajuste a quantidade.' });
    const [item] = await itensDaVenda(db, vendaId);
    expect(item.reservado).toBe(4);
  });

  it("pedido cancelado devolve as unidades", async () => {
    const [primeiro] = await pedidosDaVenda(db, vendaId);
    await db.update(schema.pedidos).set({ canceladoEm: new Date() }).where(eq(schema.pedidos.id, primeiro.id));
    const [item] = await itensDaVenda(db, vendaId);
    expect(item.reservado).toBe(2);
  });

  it("venda no balcão entra paga e entregue, e o resumo separa o que entrou", async () => {
    const r = await pedir(1, { origem: "balcao", clienteNome: "Balcão", clienteTelefone: null, pagoCom: "dinheiro", entregue: true });
    // O pedido recusado não gasta número: depois do 1 e do 2 vem o 3.
    expect("numero" in r && r.numero).toBe(3);
    const resumo = resumir(await pedidosDaVenda(db, vendaId));
    expect(resumo).toMatchObject({ pedidos: 2, vendido: 24, recebido: 8, aReceber: 16, entregues: 1, cancelados: 1 });
    expect(resumo.recebidoPor).toEqual({ pix: 0, dinheiro: 8, cartao: 0 });
  });

  it("site recusa pedido depois do encerramento, balcão continua", async () => {
    await db.update(schema.vendas).set({ encerraEm: new Date(Date.now() - 60_000) }).where(eq(schema.vendas.id, vendaId));
    expect(await pedir(1)).toEqual({ erro: "Os pedidos pelo site já foram encerrados para esta venda." });
    expect("numero" in (await pedir(1, { origem: "balcao", pagoCom: "pix", entregue: true }))).toBe(true);
  });
});
