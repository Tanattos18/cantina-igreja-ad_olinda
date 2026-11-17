/**
 * Tira o fundo dos cartazes em volta da comida, sem programas externos: "varinha mágica" que parte
 * das bordas da região e apaga os pixels parecidos com o fundo (amarelo, azul, bege), parando no
 * contorno da comida/prato. Grava cartazes/recortes/<nome>.png com transparência.
 * Uso: npx tsx scripts/recortar-cartazes.ts [nome...]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

type Regiao = {
  x: number; y: number; w: number; h: number;
  /** Diferença máxima de cor entre vizinhos para continuar o preenchimento (0–441). */
  passo: number;
  /** Diferença máxima em relação à cor da semente (evita "vazar" para dentro da comida). */
  limite: number;
  /** Sementes extras (coordenadas no cartaz), para fundos presos entre partes da comida. */
  extras?: [number, number][];
  /**
   * Formas (cx, cy, rx, ry no cartaz, expoente) onde o fundo não entra: prato/tábua e o monte de comida.
   * Expoente 2 = elipse; maior que 2 = forma mais "quadrada" (ex.: 3 para a empada).
   */
  protegidos?: ([number, number, number, number] | [number, number, number, number, number])[];
  /** Segunda passada, mais rígida, que entra nas áreas protegidas (sobras de fundo entre a comida). */
  refino?: { passo: number; limite: number };
  /** Cores chapadas do fundo do cartaz: somem em qualquer lugar (tolerância pequena, a comida não chega perto). */
  coresFundo?: { cores: [number, number, number][]; tolerancia: number; soPelaBorda?: boolean };
  /** Contornos desenhados à mão (pontos no cartaz), quando a comida tem a mesma cor do fundo. */
  poligonos?: [number, number][][];
  /** Apaga tudo o que ficar fora das áreas protegidas (quando a comida inteira está dentro delas). */
  soDentro?: boolean;
  /** Quantos pixels encolher a borda (tira a franja do fundo). Padrão 1. */
  encolher?: number;
};

const REGIOES: Record<string, Regiao> = {
  bolinho: { x: 150, y: 515, w: 790, h: 485, passo: 14, limite: 60, protegidos: [[538, 820, 378, 166], [535, 650, 270, 120], [760, 730, 140, 90]], refino: { passo: 10, limite: 48 }, soDentro: true, encolher: 3 },
  empada: {
    x: 110, y: 740, w: 870, h: 470, passo: 16, limite: 70, soDentro: true, refino: { passo: 6, limite: 22 },
    coresFundo: { cores: [[228, 194, 149], [240, 221, 197]], tolerancia: 9 },
    // A massa tem a cor do fundo bege: contorno desenhado à mão sobre o cartaz.
    poligonos: [[
      [142, 888], [180, 840], [232, 811], [300, 789], [380, 781], [460, 777], [530, 773], [565, 766], [610, 762], [680, 760],
      [760, 768], [830, 795], [890, 832], [935, 875], [955, 920], [958, 980], [952, 1050], [938, 1100], [908, 1135], [860, 1150],
      [790, 1146], [752, 1146], [738, 1168], [715, 1185], [692, 1180], [684, 1160], [676, 1140], [668, 1118], [655, 1100],
      [620, 1096], [580, 1094],
      [520, 1092], [470, 1092], [400, 1095], [330, 1093], [300, 1097], [285, 1140], [265, 1163], [242, 1162], [230, 1132],
      [222, 1100], [185, 1085], [160, 1062], [145, 1010], [138, 950],
    ]],
  },
  disco: {
    x: 40, y: 320, w: 950, h: 530, passo: 14, limite: 70, soDentro: true, refino: { passo: 9, limite: 35 },
    // Tons do fundo degradê (amostras do cartaz em volta do prato); a carne e o prato ficam longe deles.
    coresFundo: {
      cores: [[235, 213, 179], [233, 207, 170], [234, 205, 169], [227, 197, 155], [226, 192, 146], [216, 174, 113], [215, 170, 110],
        [218, 175, 117], [219, 183, 129], [227, 193, 148], [232, 208, 172], [241, 220, 193], [213, 166, 105], [232, 202, 162]],
      tolerancia: 13,
      soPelaBorda: true,
    },
    // prato (até a borda direita), monte de discos, discos da esquerda e o disco da direita
    protegidos: [[505, 700, 472, 142], [470, 500, 332, 172], [180, 605, 112, 92], [865, 628, 78, 72]],
  },
  esfirra: { x: 190, y: 470, w: 710, h: 505, passo: 16, limite: 70, protegidos: [[540, 742, 338, 248]] },
  pamonha: {
    x: 120, y: 470, w: 820, h: 530, passo: 18, limite: 80, soDentro: true, refino: { passo: 10, limite: 45 },
    // tábua, pamonha embrulhada, fatias e as linguiças/queijo da esquerda
    protegidos: [[530, 832, 382, 152], [572, 606, 296, 118], [480, 742, 292, 122], [262, 690, 82, 66]],
  },
  panqueca: { x: 140, y: 510, w: 740, h: 480, passo: 10, limite: 40 },
};

async function recortar(nome: string, r: Regiao) {
  const { data, info } = await sharp(join(process.cwd(), "cartazes", `${nome}.webp`))
    .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const fundo = new Uint8Array(W * H);
  const sementeCor = new Int32Array(W * H * 3);
  const fila: number[] = [];
  const protegido = new Uint8Array(W * H);
  for (const [cx, cy, rx, ry, n = 2] of r.protegidos ?? []) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = Math.abs((x + r.x - cx) / rx), dy = Math.abs((y + r.y - cy) / ry);
        if (dx ** n + dy ** n <= 1) protegido[y * W + x] = 1;
      }
    }
  }
  const cor = (i: number) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const dentroDe = (px: number, py: number, pol: [number, number][]) => {
    let dentro = false;
    for (let a = 0, b = pol.length - 1; a < pol.length; b = a++) {
      const [xa, ya] = pol[a], [xb, yb] = pol[b];
      if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) dentro = !dentro;
    }
    return dentro;
  };
  for (const pol of r.poligonos ?? []) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dentroDe(x + r.x, y + r.y, pol)) protegido[y * W + x] = 1;
  }
  const semear = (i: number) => {
    if (fundo[i] || protegido[i]) return;
    fundo[i] = 1;
    const c = cor(i);
    sementeCor.set(c, i * 3);
    fila.push(i);
  };
  for (let x = 0; x < W; x++) { semear(x); semear((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { semear(y * W); semear(y * W + W - 1); }
  for (const [ex, ey] of r.extras ?? []) semear((ey - r.y) * W + (ex - r.x));

  while (fila.length) {
    const i = fila.pop()!;
    const x = i % W, y = (i / W) | 0;
    const c = cor(i);
    const s = [sementeCor[i * 3], sementeCor[i * 3 + 1], sementeCor[i * 3 + 2]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (fundo[j] || protegido[j]) continue;
      const cj = cor(j);
      if (dist(cj, c) <= r.passo && dist(cj, s) <= r.limite) {
        fundo[j] = 1;
        sementeCor.set(s, j * 3);
        fila.push(j);
      }
    }
  }

  if (r.refino) {
    // Recomeça das bordas do fundo já achado, agora podendo entrar nas áreas protegidas.
    for (let i = 0; i < W * H; i++) if (fundo[i]) fila.push(i);
    while (fila.length) {
      const i = fila.pop()!;
      const x = i % W, y = (i / W) | 0;
      const c = cor(i);
      const s = [sementeCor[i * 3], sementeCor[i * 3 + 1], sementeCor[i * 3 + 2]];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (fundo[j]) continue;
        const cj = cor(j);
        const passo = protegido[j] ? r.refino.passo : r.passo;
        const limite = protegido[j] ? r.refino.limite : r.limite;
        if (dist(cj, c) <= passo && dist(cj, s) <= limite) {
          fundo[j] = 1;
          sementeCor.set(s, j * 3);
          fila.push(j);
        }
      }
    }
  }

  if (r.coresFundo) {
    const { cores, tolerancia, soPelaBorda } = r.coresFundo;
    const ehFundo = (i: number) => cores.some((f) => dist(cor(i), f) <= tolerancia);
    if (soPelaBorda) {
      // Só o que encosta no fundo já achado (grãos claros no meio da comida ficam).
      for (let i = 0; i < W * H; i++) if (fundo[i]) fila.push(i);
      while (fila.length) {
        const i = fila.pop()!;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!fundo[j] && ehFundo(j)) { fundo[j] = 1; fila.push(j); }
        }
      }
    } else {
      for (let i = 0; i < W * H; i++) if (!fundo[i] && ehFundo(i)) fundo[i] = 1;
    }
  }

  // Fica só com os pedaços grandes (some com letras soltas, enfeites e farelos do cartaz).
  const rotulo = new Int32Array(W * H).fill(-1);
  const areas: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (fundo[i] || rotulo[i] >= 0) continue;
    const id = areas.length;
    let area = 0;
    const pilha = [i];
    rotulo[i] = id;
    while (pilha.length) {
      const k = pilha.pop()!;
      area++;
      const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!fundo[j] && rotulo[j] < 0) { rotulo[j] = id; pilha.push(j); }
      }
    }
    areas.push(area);
  }
  const maior = Math.max(...areas);

  // Máscara: comida = 255. Fecha furinhos, encolhe 1px (tira a franja do fundo) e suaviza a borda.
  const mascara = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) {
    const dentro = !r.soDentro || protegido[i];
    mascara[i] = dentro && !fundo[i] && areas[rotulo[i]] >= maior * 0.08 ? 255 : 0;
  }
  const limpa = await sharp(mascara, { raw: { width: W, height: H, channels: 1 } })
    .median(5)
    .erode(r.encolher ?? 1)
    .blur(1.2)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = data[i * 3];
    rgba[i * 4 + 1] = data[i * 3 + 1];
    rgba[i * 4 + 2] = data[i * 3 + 2];
    rgba[i * 4 + 3] = limpa[i];
  }
  const saida = join(process.cwd(), "cartazes", "recortes", `${nome}.png`);
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 1 }).png().toFile(saida);
  console.log("ok", nome);
}

async function main() {
  mkdirSync(join(process.cwd(), "cartazes", "recortes"), { recursive: true });
  const pedidos = process.argv.slice(2);
  for (const [nome, r] of Object.entries(REGIOES)) {
    if (pedidos.length && !pedidos.includes(nome)) continue;
    await recortar(nome, r);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
