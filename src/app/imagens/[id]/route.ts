import { getDb } from "@/db";
import { lerImagem } from "@/lib/imagens";

/** Serve a logo e as fotos dos produtos. Imagem trocada ganha outro id, então o cache pode ser longo. */
export async function GET(_: Request, { params }: RouteContext<"/imagens/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Não encontrada", { status: 404 });
  const img = await lerImagem(await getDb(), id);
  if (!img) return new Response("Não encontrada", { status: 404 });
  return new Response(Buffer.from(img.dados, "base64"), {
    headers: { "Content-Type": img.tipo, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
