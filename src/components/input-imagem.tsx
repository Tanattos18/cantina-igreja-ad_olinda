"use client";

import { useState } from "react";

/**
 * Escolher uma foto do celular ou do computador. A imagem é reduzida aqui mesmo no navegador
 * (fotos de celular têm vários MB) e vai para o servidor num campo escondido, como data URL.
 * PNG continua PNG (logo com fundo transparente); as outras viram JPEG.
 */
export function InputImagem({ name, atual, maximo = 900, rotulo }: { name: string; atual: string | null; maximo?: number; rotulo: string }) {
  const [dados, setDados] = useState("");
  const [remover, setRemover] = useState(false);
  const [erro, setErro] = useState("");
  const previa = remover ? null : dados || atual;

  async function escolher(arquivo: File | undefined) {
    setErro("");
    if (!arquivo) return;
    if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(arquivo.type) && !arquivo.type.startsWith("image/")) {
      setErro("Escolha uma imagem (JPG ou PNG).");
      return;
    }
    try {
      const bitmap = await createImageBitmap(arquivo);
      const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const png = arquivo.type === "image/png";
      setDados(canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.85));
      setRemover(false);
    } catch {
      setErro("Não consegui abrir essa imagem. Tente outra (JPG ou PNG).");
    }
  }

  return (
    <div>
      <span className="rotulo">{rotulo}</span>
      <div className="flex items-center gap-3">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-[#d9cdbb] bg-stone-50 text-xs text-stone-400">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local */}
          {previa ? <img src={previa} alt="" className="size-full object-contain" /> : "sem foto"}
        </span>
        <div className="space-y-1.5">
          <label className="botao-sec cursor-pointer">
            {previa ? "Trocar imagem" : "Escolher imagem"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
          </label>
          {previa && (
            <button
              type="button"
              className="block text-xs font-semibold text-red-700 hover:underline"
              onClick={() => {
                setDados("");
                setRemover(!!atual);
              }}
            >
              Remover imagem
            </button>
          )}
        </div>
      </div>
      {erro && <p className="mt-1 text-sm text-red-700">{erro}</p>}
      <input type="hidden" name={name} value={dados} />
      <input type="hidden" name={`${name}Remover`} value={remover ? "1" : ""} />
    </div>
  );
}
