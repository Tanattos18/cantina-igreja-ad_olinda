import { getDb } from "@/db";
import { lerConfiguracao } from "@/lib/config";
import { lerImagem } from "@/lib/imagens";

export const dynamic = "force-dynamic";

/**
 * Logo da igreja enviada no painel (ícone do site e do app no celular).
 * Sem logo, um selo com as iniciais nas cores da igreja.
 */
export async function GET() {
  const db = await getDb();
  const c = await lerConfiguracao(db);
  const img = c.logoId ? await lerImagem(db, c.logoId) : undefined;
  if (img) {
    return new Response(Buffer.from(img.dados, "base64"), {
      headers: { "Content-Type": img.tipo, "Cache-Control": "public, max-age=300" },
    });
  }
  const iniciais = iniciaisDe(c.igreja ?? c.nome);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#f7c41b"/><text x="256" y="256" dy=".35em" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="210" fill="#0f2747">${iniciais}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
}

function iniciaisDe(nome: string): string {
  return (
    nome
      .split(/\s+/)
      .filter((p) => /^[A-ZÀ-Ú]/.test(p) && p.length > 1)
      .slice(0, 2)
      .map((p) => p[0])
      .join("") || "C"
  );
}
