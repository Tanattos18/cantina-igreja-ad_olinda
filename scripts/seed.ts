import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { and, count, eq, isNull } from "drizzle-orm";
import { fecharDb, getDb, schema, type DB } from "../src/db";

const COMBO = /\+\s*(bebida|refri|refrigerante|suco)/i;

/** Foto de cada produto (pasta fotos-produtos, licenças livres; créditos em /creditos-fotos). */
const FOTOS: [RegExp, string][] = [
  [/^pamonha/i, "pamonha"],
  [/^esf(i|ir)r?h?a/i, "esfirra"],
  [/^empada/i, "empada"],
  [/^disco/i, "disco"],
  [/^bolinho/i, "bolinho"],
];

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
      // Telefone de reservas do cartaz da Pamonhada; confirme em Configurações.
      whatsapp: "5562999639318",
    });
    console.log("Configuração criada (preencha a chave Pix no painel).");
  }

  const [{ n }] = await db.select({ n: count() }).from(schema.produtos);
  if (n === 0) {
    // Preços dos cartazes da cantina.
    await db.insert(schema.produtos).values([
      { emoji: "🌽", categoria: "Pamonhas", nome: "Pamonha", descricao: "Sal, doce ou à moda (diga o sabor na observação)", preco: 12 },
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
