import type { ReactNode } from "react";

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-titulos text-3xl font-bold text-marinho">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-stone-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Campo({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="rotulo">{rotulo}</span>
      {children}
    </label>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-stone-500">{children}</p>;
}

export function Indicador({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destaque ? "border-marinho bg-marinho text-white" : "border-[#ece4d8] bg-white"}`}>
      <p className={`text-xs font-semibold tracking-wide uppercase ${destaque ? "text-amarelo" : "text-stone-500"}`}>{rotulo}</p>
      <p className="mt-1 font-titulos text-2xl font-bold">{valor}</p>
      {detalhe && <p className={`mt-0.5 text-xs ${destaque ? "text-blue-100" : "text-stone-500"}`}>{detalhe}</p>}
    </div>
  );
}
