import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const valor = (nome: string) => numeric(nome, { precision: 12, scale: 2, mode: "number" });
const criadoEm = () => timestamp("criado_em", { withTimezone: true }).defaultNow().notNull();

/** Tipos de chave Pix aceitos na configuração. */
export const TIPOS_CHAVE_PIX = ["cpf", "cnpj", "telefone", "email", "aleatoria"] as const;
export type TipoChavePix = (typeof TIPOS_CHAVE_PIX)[number];

/** Como o cliente escolheu pagar ao fazer o pedido. */
export const PAGAR_QUANDO = ["pix_agora", "na_retirada"] as const;
export type PagarQuando = (typeof PAGAR_QUANDO)[number];

/** Como o dinheiro entrou de fato (registrado pela equipe). */
export const MEIOS_RECEBIMENTO = ["pix", "dinheiro", "cartao"] as const;
export type MeioRecebimento = (typeof MEIOS_RECEBIMENTO)[number];

export const SITUACAO_VENDA = ["rascunho", "aberta", "encerrada"] as const;
export type SituacaoVenda = (typeof SITUACAO_VENDA)[number];

/** Imagens enviadas pelo painel (logo e fotos dos produtos), já reduzidas no navegador. */
export const imagens = pgTable("imagens", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // image/png, image/jpeg ou image/webp
  // Conteúdo em base64. Cada imagem nova ganha um id novo, então o navegador pode guardar em cache.
  dados: text("dados").notNull(),
  criadoEm: criadoEm(),
});

/** Dados da cantina. Uma linha só (id = 1). */
export const configuracao = pgTable("configuracao", {
  id: integer("id").primaryKey(),
  nome: text("nome").notNull(),
  igreja: text("igreja"),
  // Frase da igreja, mostrada no topo ("Uma casa para chamar de sua").
  mensagem: text("mensagem"),
  endereco: text("endereco"),
  // Dias e horários de culto, mostrados no rodapé ("Domingo 18h30 · Quarta 20h").
  cultos: text("cultos"),
  // Só o usuário, sem @.
  instagram: text("instagram"),
  // Só dígitos, com DDI: 5581999990000. Recebe os comprovantes de Pix.
  whatsapp: text("whatsapp"),
  pixTipo: text("pix_tipo", { enum: TIPOS_CHAVE_PIX }),
  pixChave: text("pix_chave"),
  // Nome e cidade de quem recebe, como aparecem no app do banco ao pagar.
  pixNome: text("pix_nome"),
  pixCidade: text("pix_cidade"),
  logoId: integer("logo_id").references(() => imagens.id),
});

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  perfil: text("perfil", { enum: ["admin", "voluntario"] }).notNull().default("voluntario"),
  ativo: boolean("ativo").notNull().default(true),
  // Senha provisória (criada por outra pessoa): obriga a troca no próximo acesso.
  trocarSenha: boolean("trocar_senha").notNull().default(false),
  criadoEm: criadoEm(),
});

/** Histórico de tentativas de login, usado para bloquear quem tenta adivinhar senhas. */
export const tentativasLogin = pgTable(
  "tentativas_login",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    sucesso: boolean("sucesso").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index("tentativas_email_idx").on(t.email, t.criadoEm), index("tentativas_ip_idx").on(t.ip, t.criadoEm)],
);

/** Cardápio fixo da cantina (pamonha, esfiha, galinhada...). Cada venda escolhe quais entram. */
export const produtos = pgTable("produtos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  // Agrupa o cardápio na loja (abas "Pamonhas", "Salgados", "Combos"). Vazio = "Cardápio".
  categoria: text("categoria"),
  // Emoji mostrado no lugar da foto (🌽, 🥟, 🍗).
  emoji: text("emoji"),
  imagemId: integer("imagem_id").references(() => imagens.id),
  // Preço sugerido ao incluir o produto numa venda.
  preco: valor("preco").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
});

/** Um dia de venda: "Domingo, 23/11 — após o culto". O link da loja mostra a venda aberta. */
export const vendas = pgTable(
  "vendas",
  {
    id: serial("id").primaryKey(),
    titulo: text("titulo").notNull(),
    dataRetirada: date("data_retirada").notNull(),
    // Onde e quando retirar: "Na cantina, após o culto das 18h".
    retirada: text("retirada"),
    // Depois deste momento o site para de aceitar pedidos (a venda no balcão continua).
    encerraEm: timestamp("encerra_em", { withTimezone: true }),
    situacao: text("situacao", { enum: SITUACAO_VENDA }).notNull().default("rascunho"),
    criadoEm: criadoEm(),
  },
  (t) => [index("vendas_situacao_idx").on(t.situacao, t.dataRetirada)],
);

/** Produtos de uma venda, com o preço do dia e quantas unidades foram produzidas. */
export const vendaItens = pgTable(
  "venda_itens",
  {
    id: serial("id").primaryKey(),
    vendaId: integer("venda_id").notNull().references(() => vendas.id),
    produtoId: integer("produto_id").notNull().references(() => produtos.id),
    preco: valor("preco").notNull(),
    // Vazio = sem limite. Pedidos cancelados devolvem as unidades.
    limite: integer("limite"),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [uniqueIndex("venda_itens_venda_produto_idx").on(t.vendaId, t.produtoId)],
);

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    vendaId: integer("venda_id").notNull().references(() => vendas.id),
    // Número sequencial dentro da venda: é o que a pessoa fala na hora de retirar.
    numero: integer("numero").notNull(),
    // Identificador do link do pedido, impossível de adivinhar.
    codigo: text("codigo").notNull().unique(),
    origem: text("origem", { enum: ["site", "balcao"] }).notNull(),
    clienteNome: text("cliente_nome").notNull(),
    clienteTelefone: text("cliente_telefone"),
    observacao: text("observacao"),
    pagarQuando: text("pagar_quando", { enum: PAGAR_QUANDO }).notNull(),
    total: valor("total").notNull(),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
    pagoCom: text("pago_com", { enum: MEIOS_RECEBIMENTO }),
    entregueEm: timestamp("entregue_em", { withTimezone: true }),
    canceladoEm: timestamp("cancelado_em", { withTimezone: true }),
    // Quem registrou (venda no balcão) ou deu baixa.
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("pedidos_venda_numero_idx").on(t.vendaId, t.numero), index("pedidos_venda_idx").on(t.vendaId, t.criadoEm)],
);

export const pedidoItens = pgTable(
  "pedido_itens",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
    vendaItemId: integer("venda_item_id").notNull().references(() => vendaItens.id),
    // Cópia do nome e do preço no momento do pedido.
    nome: text("nome").notNull(),
    quantidade: integer("quantidade").notNull(),
    precoUnitario: valor("preco_unitario").notNull(),
    total: valor("total").notNull(),
  },
  (t) => [index("pedido_itens_pedido_idx").on(t.pedidoId), index("pedido_itens_venda_item_idx").on(t.vendaItemId)],
);

export const auditoria = pgTable(
  "auditoria",
  {
    id: serial("id").primaryKey(),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: integer("entidade_id"),
    dados: jsonb("dados"),
    criadoEm: criadoEm(),
  },
  (t) => [index("auditoria_criado_idx").on(t.criadoEm)],
);
