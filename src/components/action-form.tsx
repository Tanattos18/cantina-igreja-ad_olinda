"use client";

import { useRef, useState, type ReactNode } from "react";
import { IconeWhatsApp } from "./icones";
import type { EstadoAcao } from "@/lib/form";
import { useAcao } from "./use-acao";

type Props = {
  action: (estado: EstadoAcao, formData: FormData) => Promise<EstadoAcao>;
  children: ReactNode;
  className?: string;
  botao?: string;
  botaoClasse?: string;
  confirmar?: string;
};

/**
 * Formulário ligado a uma Server Action, com mensagem de erro/sucesso e estado de envio.
 * Em caso de erro mantém o que foi digitado; limpa só quando a ação dá certo.
 */
export function ActionForm({ action, children, className, botao = "Salvar", botaoClasse = "botao", confirmar }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, enviar, pendente] = useAcao(async (anterior, formData) => {
    const r = await action(anterior, formData);
    if (r.ok) ref.current?.reset();
    return r;
  });
  return (
    <form
      ref={ref}
      className={className}
      action={enviar.action}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) {
          e.preventDefault();
          return;
        }
        enviar.onSubmit(e);
      }}
    >
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" className={botaoClasse} disabled={pendente}>
          {pendente ? "Salvando…" : botao}
        </button>
        {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
        {estado.ok && <p className="text-sm text-green-700">{estado.ok}</p>}
      </div>
      {estado.link && <LinkCompartilhavel link={estado.link} mensagem={estado.mensagem} />}
    </form>
  );
}

/** Link gerado pela ação (ex.: convite para criar a senha), pronto para copiar ou mandar no WhatsApp. */
function LinkCompartilhavel({ link, mensagem }: { link: string; mensagem?: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = mensagem ? `${mensagem}\n${link}` : link;
  return (
    <div className="mt-3 rounded-xl border border-amarelo/60 bg-amarelo-claro p-3">
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="campo font-mono text-xs" aria-label="Link" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="botao-sec"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            } catch {}
          }}
        >
          {copiado ? "Copiado ✓" : "Copiar"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener" className="botao bg-[#1fa855] hover:bg-[#178a45]">
          <IconeWhatsApp /> Enviar no WhatsApp
        </a>
      </div>
    </div>
  );
}
