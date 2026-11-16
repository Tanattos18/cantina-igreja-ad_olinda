import type { Configuracao } from "@/lib/config";

export function Rodape({ config }: { config: Configuracao }) {
  if (!config.endereco && !config.cultos && !config.instagram) return null;
  return (
    <footer className="mx-auto mt-10 max-w-2xl px-4 text-center text-sm text-stone-500">
      <div className="mx-auto mb-4 h-px w-16 bg-amarelo" />
      {config.igreja && <p className="font-titulos text-base font-semibold text-marinho">{config.igreja}</p>}
      {config.endereco && <p className="mt-1">{config.endereco}</p>}
      {config.cultos && <p className="mt-1">Cultos: {config.cultos}</p>}
      {config.instagram && (
        <a href={`https://instagram.com/${config.instagram}`} target="_blank" rel="noopener" className="link mt-2 inline-block">
          @{config.instagram}
        </a>
      )}
    </footer>
  );
}
