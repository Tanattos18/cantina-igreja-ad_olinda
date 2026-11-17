import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { fecharDb, getDb, schema, type DB } from "../src/db";

const COMBO = /\+\s*(bebida|refri|refrigerante|suco)/i;

/** Foto de cada produto (pasta fotos-produtos, feitas dos cartazes da cantina por scripts/fotos-cartazes.ts). */
const FOTOS: [RegExp, string][] = [
  [/^pamonha/i, "pamonha"],
  [/^esf(i|ir)r?h?a/i, "esfirra"],
  [/^empada/i, "empada"],
  [/^disco/i, "disco"],
  [/^bolinho/i, "bolinho"],
  [/^panqueca/i, "panqueca"],
];

/** Arquivo da foto de um produto pelo nome ("Esfirra + bebida" → esfirra-combo). */
function fotoDoProduto(nome: string): string | undefined {
  const base = FOTOS.find(([re]) => re.test(nome.trim()))?.[1];
  return base && (COMBO.test(nome) ? `${base}-combo` : base);
}

/** SHA-256 das fotos ilustrativas antigas (Wikimedia), para trocar só essas e nunca uma foto enviada pela equipe. */
const FOTOS_ANTIGAS = new Set([
  "b4fbe569e52cac36e3f60e38e858b15caa3f8f942d29b4e3c72a3245d7822492", "e31f8b5f3a4e6dbafef563ae7136dade051f615f72ae5717c11b4d2d9a4b4694",
  "7be368a5f77ea2cbd1994733c333dae11c8cbc8723cd9951d78f4db206cebc92", "924bde05ac2f54c1bfc7bb634e714d0d982234265ae0d57962848f065b9866c8",
  "29d00a0269a0b24817f1c1ea82264cb88b782ebe2f803c2f80dc2724aca59b29", "6dd012da1724dd4efaa3bbf7b3b2081793f81d38f86c14cc2b0d1ee303b8524c",
  "610037c70d42fcef501151c72356065f7d66d50d4f7bc631591222d29cd66938", "87147341e9dc77d2dfeff04a0cb6e98c9062e6745a4947acdd193f20f1ee5381",
  "221aaea38518d55cefeb995e4718516b5e5509ac247d8a5cbf99a8be4daab962", "b3978204a66a44cbceec60d0f09c43e37f8005419bf5b173b858136194e1117b",
]);

/**
 * Uma vez só: troca as fotos ilustrativas antigas pelas dos cartazes da cantina (e põe foto em quem não tem).
 * Foto enviada pela equipe no painel não é tocada.
 */
async function fotosDosCartazes(db: DB) {
  const A = schema.auditoria;
  const [feito] = await db.select({ id: A.id }).from(A).where(eq(A.acao, "fotos_cartazes_v1")).limit(1);
  if (feito) return;
  const pasta = join(process.cwd(), "fotos-produtos");
  const produtos = await db
    .select({ id: schema.produtos.id, nome: schema.produtos.nome, imagemId: schema.produtos.imagemId, dados: schema.imagens.dados })
    .from(schema.produtos)
    .leftJoin(schema.imagens, eq(schema.imagens.id, schema.produtos.imagemId));
  const gravadas = new Map<string, number>();
  let n = 0;
  for (const p of produtos) {
    const arquivo = fotoDoProduto(p.nome);
    const caminho = arquivo && join(pasta, `${arquivo}.jpg`);
    if (!arquivo || !caminho || !existsSync(caminho)) continue;
    const antiga = p.dados && FOTOS_ANTIGAS.has(createHash("sha256").update(Buffer.from(p.dados, "base64")).digest("hex"));
    if (p.imagemId && !antiga) continue;
    if (!gravadas.has(arquivo)) {
      const [img] = await db.insert(schema.imagens).values({ tipo: "image/jpeg", dados: readFileSync(caminho).toString("base64") }).returning({ id: schema.imagens.id });
      gravadas.set(arquivo, img.id);
    }
    await db.update(schema.produtos).set({ imagemId: gravadas.get(arquivo)! }).where(eq(schema.produtos.id, p.id));
    n++;
  }
  await db.insert(A).values({ acao: "fotos_cartazes_v1", entidade: "produto", dados: { produtos: n } });
  console.log(`Fotos dos cartazes em ${n} produtos.`);
}

/**
 * Uma vez só: a logo oficial da AD Olinda (marca/ad-olinda-selo.png: símbolo num círculo branco)
 * no lugar da logo tirada do Instagram. Depois, quem manda é o painel (Configurações).
 */
async function logoOficial(db: DB) {
  const A = schema.auditoria;
  const [feito] = await db.select({ id: A.id }).from(A).where(eq(A.acao, "logo_oficial_v1")).limit(1);
  if (feito) return;
  const arquivo = join(process.cwd(), "marca", "ad-olinda-selo.png");
  if (!existsSync(arquivo)) return;
  const [img] = await db.insert(schema.imagens).values({ tipo: "image/png", dados: readFileSync(arquivo).toString("base64") }).returning({ id: schema.imagens.id });
  await db.update(schema.configuracao).set({ logoId: img.id }).where(eq(schema.configuracao.id, 1));
  await db.insert(A).values({ acao: "logo_oficial_v1", entidade: "configuracao" });
  console.log("Logo oficial da AD Olinda aplicada.");
}

const SABORES_PAMONHA = [
  { nome: "Pamonha doce", descricao: "Pamonha doce" },
  { nome: "Pamonha à moda", descricao: "Pamonha à moda" },
];

/**
 * Uma vez só, para quem já tinha a "Pamonha" única: vira "Pamonha de sal" e nascem a doce e a
 * à moda (mesma foto, preço e categoria), que entram também nas vendas abertas ou em rascunho.
 */
async function separarPamonhas(db: DB) {
  const A = schema.auditoria;
  const P = schema.produtos;
  const [feito] = await db.select({ id: A.id }).from(A).where(eq(A.acao, "pamonhas_3_sabores")).limit(1);
  if (feito) return;
  await db.transaction(async (tx) => {
    let [sal] = await tx.select().from(P).where(eq(P.nome, "Pamonha de sal")).limit(1);
    if (!sal) {
      const [antiga] = await tx.select().from(P).where(eq(P.nome, "Pamonha")).limit(1);
      if (antiga) {
        await tx.update(P).set({ nome: "Pamonha de sal", descricao: "Pamonha salgada" }).where(eq(P.id, antiga.id));
        sal = { ...antiga, nome: "Pamonha de sal" };
      }
    }
    if (sal) {
      const itens = await tx
        .select({ vendaId: schema.vendaItens.vendaId, preco: schema.vendaItens.preco, limite: schema.vendaItens.limite, ativo: schema.vendaItens.ativo })
        .from(schema.vendaItens)
        .innerJoin(schema.vendas, eq(schema.vendas.id, schema.vendaItens.vendaId))
        .where(and(eq(schema.vendaItens.produtoId, sal.id), inArray(schema.vendas.situacao, ["aberta", "rascunho"])));
      for (const s of SABORES_PAMONHA) {
        const [ja] = await tx.select({ id: P.id }).from(P).where(eq(P.nome, s.nome)).limit(1);
        if (ja) continue;
        const [novo] = await tx
          .insert(P)
          .values({ ...s, categoria: sal.categoria, emoji: sal.emoji, imagemId: sal.imagemId, preco: sal.preco, ativo: sal.ativo })
          .returning({ id: P.id });
        if (itens.length) await tx.insert(schema.vendaItens).values(itens.map((i) => ({ ...i, produtoId: novo.id })));
        console.log(`${s.nome} criada (${itens.length} venda(s) atualizada(s)).`);
      }
    }
    await tx.insert(A).values({ acao: "pamonhas_3_sabores", entidade: "produto" });
  });
}

/**
 * Uma vez só: coloca as fotos nos produtos que ainda não têm. Depois disso não mexe mais,
 * para não voltar uma foto que a equipe tirou ou trocou pelo painel.
 */
async function fotosIniciais(db: DB) {
  const A = schema.auditoria;
  const [feito] = await db.select({ id: A.id }).from(A).where(eq(A.acao, "fotos_iniciais")).limit(1);
  if (feito) return;
  const pasta = join(process.cwd(), "fotos-produtos");
  const produtos = await db.select({ id: schema.produtos.id, nome: schema.produtos.nome }).from(schema.produtos).where(isNull(schema.produtos.imagemId));
  const gravadas = new Map<string, number>();
  let n = 0;
  for (const p of produtos) {
    const base = FOTOS.find(([re]) => re.test(p.nome.trim()))?.[1];
    // Combos ("Esfirra + bebida", "Disco + refri"): a mesma foto com a latinha no canto.
    const arquivo = base && (COMBO.test(p.nome) ? `${base}-combo` : base);
    const caminho = arquivo && join(pasta, `${arquivo}.jpg`);
    if (!arquivo || !caminho || !existsSync(caminho)) continue;
    if (!gravadas.has(arquivo)) {
      const [img] = await db
        .insert(schema.imagens)
        .values({ tipo: "image/jpeg", dados: readFileSync(caminho).toString("base64") })
        .returning({ id: schema.imagens.id });
      gravadas.set(arquivo, img.id);
    }
    await db
      .update(schema.produtos)
      .set({ imagemId: gravadas.get(arquivo)! })
      .where(and(eq(schema.produtos.id, p.id), isNull(schema.produtos.imagemId)));
    n++;
  }
  await db.insert(A).values({ acao: "fotos_iniciais", entidade: "produto", dados: { produtos: n } });
  console.log(`Fotos colocadas em ${n} produtos.`);
}

/**
 * Carga inicial: dados da AD Olinda e o cardápio dos cartazes da cantina.
 * O administrador é criado na primeira visita ao /login (ou aqui, com ADMIN_EMAIL e ADMIN_PASSWORD).
 * Pode rodar mais de uma vez: só cria o que ainda não existe.
 */
/** Número de reservas do cartaz da Pamonhada, que a primeira versão usou por engano. */
const NUMERO_DO_CARTAZ = "5562999639318";

export async function cargaInicial(db: DB) {
  const [config] = await db.select().from(schema.configuracao).where(eq(schema.configuracao.id, 1));
  if (!config) {
    await db.insert(schema.configuracao).values({
      id: 1,
      nome: "Cantina AD Olinda",
      igreja: "Assembleia de Deus Residencial Olinda",
      mensagem: "Uma casa para chamar de sua",
      endereco: "Rua MA-14, Qd. 02, Lt. 09 — Residencial Olinda",
      cultos: "Domingo 18h30 · Quarta 20h",
      instagram: "ad.olinda.oficial",
    });
    console.log("Configuração criada (preencha a chave Pix no painel).");
  } else if (config.whatsapp === NUMERO_DO_CARTAZ) {
    // O número do cartaz da Pamonhada era o celular pessoal de quem coordena: os comprovantes
    // passam a ir para o caixa da venda (WhatsApp de cada pessoa em Minha conta).
    await db.update(schema.configuracao).set({ whatsapp: null }).where(eq(schema.configuracao.id, 1));
    console.log("WhatsApp de reserva removido (era o número do cartaz).");
  }

  const [{ n }] = await db.select({ n: count() }).from(schema.produtos);
  if (n === 0) {
    // Preços dos cartazes da cantina.
    await db.insert(schema.produtos).values([
      { emoji: "🌽", categoria: "Pamonhas", nome: "Pamonha de sal", descricao: "Pamonha salgada", preco: 12 },
      { emoji: "🌽", categoria: "Pamonhas", nome: "Pamonha doce", descricao: "Pamonha doce", preco: 12 },
      { emoji: "🌽", categoria: "Pamonhas", nome: "Pamonha à moda", descricao: "Pamonha à moda", preco: 12 },
      { emoji: "🌽", categoria: "Combos", nome: "Pamonha + bebida", descricao: "Pamonha de qualquer sabor com bebida", preco: 16 },
      { emoji: "🥟", categoria: "Salgados", nome: "Esfirra", descricao: "Carne ou queijo", preco: 8 },
      { emoji: "🥟", categoria: "Combos", nome: "Esfirra + bebida", descricao: "Esfirra de carne ou queijo com bebida", preco: 12 },
      { emoji: "🥧", categoria: "Salgados", nome: "Empada de frango", preco: 8 },
      { emoji: "🥧", categoria: "Combos", nome: "Empada + bebida", preco: 12 },
      { emoji: "🍔", categoria: "Salgados", nome: "Disco de carne", preco: 8 },
      { emoji: "🍔", categoria: "Combos", nome: "Disco + refri", preco: 12 },
      { emoji: "🌽", categoria: "Combos", nome: "Bolinho de milho + bebida", descricao: "Bolinho frito de milho com bebida", preco: 12 },
    ]);
    console.log("Cardápio criado.");
  }

  await fotosIniciais(db);
  await separarPamonhas(db);
  await logoOficial(db);
  await fotosDosCartazes(db);

  const [{ u }] = await db.select({ u: count() }).from(schema.usuarios);
  if (u === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await db.insert(schema.usuarios).values({
      nome: "Administrador",
      email: process.env.ADMIN_EMAIL.toLowerCase(),
      senhaHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
      perfil: "admin",
    });
    console.log(`Administrador criado: ${process.env.ADMIN_EMAIL}`);
  } else if (u === 0) {
    console.log("Sem administrador ainda: crie no primeiro acesso a /login.");
  }
}

async function main() {
  await cargaInicial(await getDb());
  console.log("Carga inicial concluída.");
  await fecharDb();
  process.exit(0);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts")) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
