"use client";

import { useState } from "react";
import { IconeWhatsApp } from "@/components/icones";

/** Link da loja pronto para mandar no grupo da igreja. */
export function CompartilharLink({ url, titulo, data }: { url: string; titulo: string; data: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `🍽️ *${titulo}*\nRetirada ${data}.\nFaça seu pedido pelo celular e retire sem fila:\n${url}`;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amarelo/60 bg-amarelo-claro px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-amber-900 uppercase">Link para os pedidos</p>
        <p className="truncate font-mono text-sm text-marinho">{url}</p>
      </div>
      <button
        type="button"
        className="botao-sec"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {}
        }}
      >
        {copiado ? "Copiado ✓" : "Copiar link"}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener" className="botao bg-[#1fa855] hover:bg-[#178a45]">
        <IconeWhatsApp /> Enviar no WhatsApp
      </a>
    </div>
  );
}
