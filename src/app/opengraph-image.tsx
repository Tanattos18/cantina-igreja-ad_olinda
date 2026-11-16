import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getDb, schema } from "@/db";
import { lerConfiguracao } from "@/lib/config";
import { dataExtenso } from "@/lib/formato";
import { lerImagem } from "@/lib/imagens";
import { vendaAberta } from "@/lib/vendas";

/** Arte que aparece quando o link da cantina é compartilhado (WhatsApp, Instagram, Facebook). */
export const alt = "Cantina AD Olinda: faça seu pedido pelo celular";
export const size = { width: 1200, height: 630 };
// JPEG leve: o WhatsApp deixa de mostrar a prévia quando a imagem é pesada.
export const contentType = "image/jpeg";
// Lê a logo e as fotos do banco a cada pedido (trocou no painel, a arte acompanha).
export const dynamic = "force-dynamic";

const fonte = (arquivo: string) => readFile(join(process.cwd(), "src/app/fontes", arquivo));

const MARINHO = "#0f2747";
const AMARELO = "#f7c41b";

const comoDataUrl = (img: { tipo: string; dados: string } | undefined) => (img ? `data:${img.tipo};base64,${img.dados}` : null);

export default async function Image() {
  const db = await getDb();
  const [config, venda, titulos, textoForte, textoExtra] = await Promise.all([
    lerConfiguracao(db),
    vendaAberta(db),
    fonte("fraunces-latin-700-normal.woff"),
    fonte("nunito-sans-latin-700-normal.woff"),
    fonte("nunito-sans-latin-800-normal.woff"),
  ]);

  // Até 3 fotos diferentes dos salgados (sem repetir a mesma imagem dos combos).
  const comFoto = await db
    .select({ imagemId: schema.produtos.imagemId, nome: schema.produtos.nome })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.ativo, true), isNotNull(schema.produtos.imagemId)))
    .orderBy(asc(schema.produtos.id));
  const ids = [...new Set(comFoto.filter((p) => !/\+/.test(p.nome)).map((p) => p.imagemId!))].slice(0, 3);
  const [logo, ...fotos] = await Promise.all([
    config.logoId ? lerImagem(db, config.logoId) : Promise.resolve(undefined),
    ...ids.map((id) => lerImagem(db, id)),
  ]);
  const logoUrl = comoDataUrl(logo);
  const fotoUrls = fotos.map(comoDataUrl).filter((u): u is string => !!u);
  const nomes = [...new Set(comFoto.filter((p) => !/\+/.test(p.nome)).map((p) => p.nome.replace(/ (de|à|doce).*$/i, "")))].slice(0, 5);

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: MARINHO, position: "relative", fontFamily: "Nunito" }}>
        {/* Brilho amarelo ao fundo */}
        <div style={{ position: "absolute", top: -160, right: 260, width: 520, height: 520, borderRadius: 999, background: AMARELO, opacity: 0.16 }} />
        <div style={{ position: "absolute", bottom: -200, left: -120, width: 460, height: 460, borderRadius: 999, background: AMARELO, opacity: 0.08 }} />

        {/* Texto */}
        <div style={{ display: "flex", flexDirection: "column", width: 640, padding: "56px 0 52px 64px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem gerada pelo ImageResponse
              <img alt="" src={logoUrl} width={96} height={96} style={{ objectFit: "contain", borderRadius: 18, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 999, background: AMARELO, color: MARINHO, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces", fontSize: 40 }}>
                AD
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 22, flex: 1 }}>
              <div style={{ color: AMARELO, fontSize: 19, fontWeight: 800, letterSpacing: 2, lineHeight: 1.25 }}>{(config.igreja ?? "Cantina").toUpperCase()}</div>
              {config.mensagem && <div style={{ color: "#c9d6ea", fontSize: 24, marginTop: 4 }}>{config.mensagem}</div>}
            </div>
          </div>

          <div style={{ display: "flex", color: "white", fontFamily: "Fraunces", fontSize: 78, lineHeight: 1.02, marginTop: 40 }}>{config.nome}</div>

          <div style={{ display: "flex", marginTop: 26 }}>
            <div style={{ display: "flex", background: AMARELO, color: MARINHO, fontSize: 30, fontWeight: 800, padding: "12px 28px", borderRadius: 999 }}>
              {venda ? venda.titulo : "Faça seu pedido pelo celular"}
            </div>
          </div>
          <div style={{ display: "flex", color: "#e9eef6", fontSize: 26, marginTop: 18 }}>
            {venda ? `Retirada ${dataExtenso(venda.dataRetirada)}` : "Peça antes e retire sem fila"}
          </div>

          <div style={{ display: "flex", marginTop: "auto", color: "#c9d6ea", fontSize: 24 }}>
            {nomes.join(" · ")}
          </div>
          <div style={{ display: "flex", color: AMARELO, fontSize: 24, fontWeight: 800, marginTop: 8 }}>Pix ou pague na retirada</div>
        </div>

        {/* Fotos */}
        <div style={{ display: "flex", position: "relative", flex: 1 }}>
          {fotoUrls[0] && (
            <div style={{ position: "absolute", top: 70, left: 40, width: 420, height: 315, borderRadius: 32, overflow: "hidden", border: "8px solid white", transform: "rotate(4deg)", display: "flex", boxShadow: "0 24px 48px rgba(0,0,0,0.45)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada pelo ImageResponse */}
              <img alt="" src={fotoUrls[0]} width={420} height={315} style={{ objectFit: "cover" }} />
            </div>
          )}
          {fotoUrls[1] && (
            <div style={{ position: "absolute", top: 360, left: 0, width: 260, height: 195, borderRadius: 26, overflow: "hidden", border: "7px solid white", transform: "rotate(-5deg)", display: "flex", boxShadow: "0 20px 40px rgba(0,0,0,0.45)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada pelo ImageResponse */}
              <img alt="" src={fotoUrls[1]} width={260} height={195} style={{ objectFit: "cover" }} />
            </div>
          )}
          {fotoUrls[2] && (
            <div style={{ position: "absolute", top: 380, left: 280, width: 250, height: 188, borderRadius: 26, overflow: "hidden", border: "7px solid white", transform: "rotate(3deg)", display: "flex", boxShadow: "0 20px 40px rgba(0,0,0,0.45)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada pelo ImageResponse */}
              <img alt="" src={fotoUrls[2]} width={250} height={188} style={{ objectFit: "cover" }} />
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: titulos, weight: 700, style: "normal" },
        { name: "Nunito", data: textoForte, weight: 700, style: "normal" },
        { name: "Nunito", data: textoExtra, weight: 800, style: "normal" },
      ],
    },
  );

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=600, s-maxage=600" },
  });
}
