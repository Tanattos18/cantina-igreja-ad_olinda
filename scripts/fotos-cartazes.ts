/**
 * Imagens dos produtos a partir dos cartazes da própria cantina (pasta cartazes/).
 * Usa a comida já sem fundo (cartazes/recortes, de scripts/recortar-cartazes.ts) e monta 900x675:
 * fundo creme/amarelo da cantina, comida inteira no quadrado central (a loja recorta em quadrado).
 * Combos: a mesma imagem com a latinha (marca/lata.jpg) no canto e o selo "+ bebida".
 * Uso: npx tsx scripts/fotos-cartazes.ts   → grava em fotos-produtos/
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const W = 900;
const H = 675;
const RAIZ = process.cwd();
const SAIDA = join(RAIZ, "fotos-produtos");

const PRODUTOS = ["bolinho", "empada", "disco", "esfirra", "pamonha", "panqueca"];

/** Comida recortada (cartazes/recortes, feita por scripts/recortar-cartazes.ts) sobre fundo limpo da cantina. */
async function montar(nome: string): Promise<Buffer> {
  const fundo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="f" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#fffaf0"/><stop offset="0.6" stop-color="#fdefc6"/><stop offset="1" stop-color="#f6cd5f"/></radialGradient>
      <radialGradient id="h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#f)"/>
    <circle cx="450" cy="330" r="310" fill="url(#h)"/>
  </svg>`);
  // Comida no quadrado central (largura até 640), um pouco abaixo do meio, com sombra embaixo.
  const comida = await sharp(join(RAIZ, "cartazes", "recortes", `${nome}.png`)).resize(640, 520, { fit: "inside" }).toBuffer();
  const m = await sharp(comida).metadata();
  const left = Math.round((W - m.width!) / 2);
  const top = Math.round((H - m.height!) / 2 + 12);
  const sombra = await sharp(
    Buffer.from(`<svg width="${W}" height="${H}"><ellipse cx="${W / 2}" cy="${top + m.height! - 10}" rx="${m.width! * 0.46}" ry="${Math.max(26, m.height! * 0.09)}" fill="#6b4a1a" opacity="0.32"/></svg>`),
  )
    .blur(16)
    .png()
    .toBuffer();
  return sharp(fundo).composite([{ input: sombra }, { input: comida, left, top }]).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

/** Cartão da latinha no canto inferior direito (dentro do quadrado central) e selo "+ bebida". */
async function comLatinha(base: Buffer): Promise<Buffer> {
  const CW = 210, CH = 280, R = 24, B = 7;
  const X = W - 112 - CW - 16, Y = H - CH - 20;
  const lata = await sharp(join(RAIZ, "marca", "lata.jpg")).resize(CW - 2 * B, CH - 2 * B, { fit: "cover" }).toBuffer();
  const mascara = Buffer.from(`<svg width="${CW - 2 * B}" height="${CH - 2 * B}"><rect width="${CW - 2 * B}" height="${CH - 2 * B}" rx="${R - B}" fill="#fff"/></svg>`);
  const lataRedonda = await sharp(lata).composite([{ input: mascara, blend: "dest-in" }]).png().toBuffer();
  const cartao = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: Buffer.from(`<svg width="${CW}" height="${CH}"><rect width="${CW}" height="${CH}" rx="${R}" fill="#fff"/></svg>`) },
      { input: lataRedonda, left: B, top: B },
    ])
    .png()
    .toBuffer();
  const sombra = await sharp(Buffer.from(`<svg width="${CW + 40}" height="${CH + 40}"><rect x="20" y="24" width="${CW}" height="${CH}" rx="${R}" fill="#000" opacity="0.45"/></svg>`))
    .blur(10)
    .png()
    .toBuffer();
  const selo = Buffer.from(
    `<svg width="160" height="46"><rect width="160" height="46" rx="23" fill="#f7c41b"/><text x="80" y="31" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="22" fill="#0f2747">+ bebida</text></svg>`,
  );
  return sharp(base)
    .composite([
      { input: sombra, left: X - 20, top: Y - 24 },
      { input: cartao, left: X, top: Y },
      { input: selo, left: X + (CW - 160) / 2, top: Y + CH - 46 - 12 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

async function main() {
  mkdirSync(SAIDA, { recursive: true });
  if (!existsSync(join(RAIZ, "marca", "lata.jpg"))) throw new Error("Falta marca/lata.jpg");
  for (const nome of PRODUTOS) {
    const base = await montar(nome);
    writeFileSync(join(SAIDA, `${nome}.jpg`), base);
    writeFileSync(join(SAIDA, `${nome}-combo.jpg`), await comLatinha(base));
    console.log("ok", nome);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
