"use client";

import { useState } from "react";

export function Copiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegadores antigos: seleciona o campo para a pessoa copiar na mão.
      document.getElementById("pix-codigo")?.focus();
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }
  return (
    <div className="mt-2 space-y-2">
      <input id="pix-codigo" readOnly value={texto} onFocus={(e) => e.currentTarget.select()} className="campo font-mono text-xs" aria-label="Código Pix copia e cola" />
      <button type="button" onClick={copiar} className="botao w-full py-3 text-base">
        {copiado ? "Código copiado ✓" : "Copiar código Pix"}
      </button>
    </div>
  );
}
