import { count } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionForm } from "@/components/action-form";
import { Campo } from "@/components/ui";
import { Logo } from "@/components/marca";
import { criarPrimeiroAdmin, entrar } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel da cantina" };

export default async function LoginPage() {
  const [{ n }] = await (await getDb()).select({ n: count() }).from(schema.usuarios);
  const primeiroAcesso = n === 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-marinho p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl">
        <Logo nome="AD Olinda" tamanho={56} />
        {primeiroAcesso ? (
          <>
            <h1 className="mt-4 font-titulos text-3xl font-bold text-marinho">Bem-vindo!</h1>
            <p className="mb-6 text-sm text-gray-500">Primeiro acesso: crie o administrador da cantina. Depois ele cadastra o restante da equipe.</p>
            <ActionForm action={criarPrimeiroAdmin} botao="Criar e entrar" botaoClasse="botao w-full py-3 text-base">
              <div className="space-y-4">
                <Campo rotulo="Seu nome">
                  <input name="nome" className="campo" autoComplete="name" required maxLength={80} />
                </Campo>
                <Campo rotulo="E-mail (usado para entrar)">
                  <input name="email" type="email" className="campo" autoComplete="username" required />
                </Campo>
                <Campo rotulo="Senha (mín. 8, com letras e números)">
                  <input name="senha" type="password" minLength={8} className="campo" autoComplete="new-password" required />
                </Campo>
              </div>
            </ActionForm>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-titulos text-3xl font-bold text-marinho">Painel da cantina</h1>
            <p className="mb-6 text-sm text-gray-500">Pedidos, balcão, vendas e cardápio da cantina.</p>
            <ActionForm action={entrar} botao="Entrar" botaoClasse="botao w-full py-3 text-base">
              <div className="space-y-4">
                <Campo rotulo="E-mail">
                  <input name="email" type="email" className="campo" autoComplete="username" required />
                </Campo>
                <Campo rotulo="Senha">
                  <input name="senha" type="password" className="campo" autoComplete="current-password" required />
                </Campo>
              </div>
            </ActionForm>
          </>
        )}
      </div>
    </main>
  );
}
