import Link from "next/link";
import creditos from "../../../fotos-produtos/creditos.json";

export const metadata = { title: "Créditos das fotos" };

const NOMES: Record<string, string> = {
  pamonha: "Pamonha",
  esfirra: "Esfirra",
  empada: "Empada",
  disco: "Disco de carne",
  bolinho: "Bolinho de milho",
  lata: "Latinha dos combos",
};

/** Atribuição exigida pelas licenças Creative Commons das fotos ilustrativas do cardápio. */
export default function CreditosFotos() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-titulos text-3xl font-bold text-marinho">Créditos das fotos</h1>
      <p className="mt-2 text-sm text-stone-600">
        As imagens dos produtos vêm dos cartazes da própria cantina (@ad.olinda.oficial) e são ilustrativas.
        A foto da latinha usada nos combos vem do Wikimedia Commons, com licença livre:
      </p>
      <ul className="mt-6 space-y-3">
        {Object.entries(creditos).map(([chave, c]) => (
          <li key={chave} className="cartao p-4 text-sm">
            <p className="font-bold">{NOMES[chave] ?? chave}</p>
            <p className="text-stone-600">
              Foto de {c.autor} ·{" "}
              {c.licencaUrl ? (
                <a href={c.licencaUrl} target="_blank" rel="noopener" className="link">{c.licenca}</a>
              ) : (
                c.licenca
              )}{" "}
              ·{" "}
              <a href={c.pagina} target="_blank" rel="noopener" className="link">original</a>
            </p>
          </li>
        ))}
      </ul>
      <Link href="/" className="botao-sec mt-8">Voltar para a cantina</Link>
    </main>
  );
}
