import Link from "next/link";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { lerConfiguracao } from "@/lib/config";
import { vendaAberta } from "@/lib/vendas";
import { Logo } from "@/components/marca";
import { sair } from "../login/actions";
import { abrirCantina } from "./vendas/actions";

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  const usuario = await exigirUsuario();
  const db = await getDb();
  const [config, aberta] = await Promise.all([lerConfiguracao(db), vendaAberta(db)]);
  const menu = [
    ...(aberta
      ? [
          { href: `/painel/vendas/${aberta.id}`, rotulo: "Pedidos de hoje" },
          { href: `/painel/vendas/${aberta.id}/balcao`, rotulo: "Venda no balcão" },
        ]
      : []),
    { href: "/painel/vendas", rotulo: "Vendas" },
    { href: "/painel/produtos", rotulo: "Cardápio" },
    ...(usuario.perfil === "admin"
      ? [
          { href: "/painel/configuracoes", rotulo: "Configurações" },
          { href: "/painel/usuarios", rotulo: "Equipe" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row print:bg-white">
      <aside className="bg-marinho text-blue-100 print:hidden md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-4">
          <Logo nome={config.igreja ?? config.nome} versao={config.logoId} tamanho={40} />
          <div className="min-w-0">
            <Link href="/painel" className="block truncate font-titulos text-lg leading-tight font-semibold text-white">{config.nome}</Link>
            <p className="truncate text-xs text-blue-200">{usuario.nome}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] md:block md:space-y-0.5">
          {menu.map((i) => (
            <Link key={i.href} href={i.href} className="block shrink-0 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap hover:bg-white/10 hover:text-white">
              {i.rotulo}
            </Link>
          ))}
          <div className="flex shrink-0 gap-1 md:mt-4 md:block md:space-y-0.5 md:border-t md:border-white/10 md:pt-4">
            <a href="/" target="_blank" rel="noopener" className="block rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-amarelo hover:bg-white/10">Ver a loja ↗</a>
            <Link href="/painel/conta" className="block rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-white/10">Minha senha</Link>
            <form action={sair}>
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap text-blue-200 hover:bg-white/10 hover:text-red-200">Sair</button>
            </form>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8 print:p-0">
        {!aberta && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-amarelo px-5 py-3 text-marinho print:hidden">
            <p className="min-w-0 flex-1 font-bold">🔴 A cantina está fechada: quem abre o link ainda não vê o cardápio.</p>
            <form action={abrirCantina}>
              <button className="botao bg-green-700 px-5 py-3 text-base hover:bg-green-800">🟢 Abrir a cantina agora</button>
            </form>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
