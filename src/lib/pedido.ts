import { centavos } from "./formato";
import { MAX_ITENS_PEDIDO, QTD_MAX_POR_ITEM, restante } from "./dominio";

/** O que o navegador envia. Preços nunca vêm do cliente: tudo é recalculado com a venda. */
export type ItemEscolhido = { vendaItemId: number; quantidade: number };

export type ItemDaVenda = {
  id: number;
  nome: string;
  preco: number;
  limite: number | null;
  /** Unidades já pedidas (pedidos não cancelados). */
  reservado: number;
  ativo: boolean;
};

export type ItemCalculado = {
  vendaItemId: number;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
};

export type PedidoCalculado = { itens: ItemCalculado[]; total: number };

/** Junta linhas repetidas do mesmo produto e confere quantidade, preço e unidades que ainda restam. */
export function calcularPedido(escolhidos: ItemEscolhido[], venda: Map<number, ItemDaVenda>): PedidoCalculado | string {
  const somados = new Map<number, number>();
  for (const e of escolhidos) somados.set(e.vendaItemId, (somados.get(e.vendaItemId) ?? 0) + e.quantidade);
  const linhas = [...somados].filter(([, q]) => q !== 0);
  if (linhas.length === 0) return "Escolha pelo menos um item.";
  if (linhas.length > MAX_ITENS_PEDIDO) return "Pedido com itens demais.";

  const itens: ItemCalculado[] = [];
  for (const [id, quantidade] of linhas) {
    const item = venda.get(id);
    if (!item || !item.ativo) return "Um dos itens escolhidos não está mais à venda. Atualize a página.";
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > QTD_MAX_POR_ITEM) {
      return `"${item.nome}": quantidade inválida.`;
    }
    const resta = restante(item.limite, item.reservado);
    if (resta != null && quantidade > resta) {
      return resta === 0
        ? `"${item.nome}" esgotou. Remova do pedido para continuar.`
        : `"${item.nome}": só restam ${resta}. Ajuste a quantidade.`;
    }
    itens.push({ vendaItemId: id, nome: item.nome, quantidade, precoUnitario: item.preco, total: centavos(item.preco * quantidade) });
  }
  return { itens, total: centavos(itens.reduce((s, i) => s + i.total, 0)) };
}
