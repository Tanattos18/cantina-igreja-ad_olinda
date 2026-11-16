import Link from "next/link";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { lerConfiguracao } from "@/lib/config";
import { hashConvite } from "@/lib/convite";
import { ActionForm } from "@/components/action-form";
import { Campo } from "@/components/ui";
import { Logo } from "@/components/marca";
import { criarSenhaPeloConvite } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar senha", robots: { index: false } };

export default async function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const db = await getDb();
  const U = schema.usuarios;
  const [[u], config] = await Promise.all([
    db
      .select({ nome: U.nome, email: U.email })
      .from(U)
      .where(and(eq(U.conviteHash, hashConvite(token)), gt(U.conviteExpiraEm, new Date()), eq(U.ativo, true))),
    lerConfiguracao(db),
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-marinho p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl">
        <Logo nome={config.igreja ?? config.nome} versao={config.logoId} tamanho={56} />
        {u ? (
          <>
            <h1 className="mt-4 font-titulos text-3xl font-bold text-marinho">Olá, {u.nome.split(" ")[0]}!</h1>
            <p className="mb-6 text-sm text-stone-500">
              Crie sua senha para entrar no painel da {config.nome}. Seu e-mail de acesso é <strong className="text-tinta">{u.email}</strong>.
            </p>
            <ActionForm action={criarSenhaPeloConvite} botao="Criar senha e entrar" botaoClasse="botao w-full py-3 text-base">
              <input type="hidden" name="token" value={token} />
              <div className="space-y-4">
                <Campo rotulo="Nova senha (mín. 8, com letras e números)">
                  <input name="senha" type="password" minLength={8} className="campo" autoComplete="new-password" required />
                </Campo>
                <Campo rotulo="Repita a senha">
                  <input name="confirmacao" type="password" minLength={8} className="campo" autoComplete="new-password" required />
                </Campo>
              </div>
            </ActionForm>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-titulos text-2xl font-bold text-marinho">Este link não vale mais</h1>
            <p className="mt-2 text-sm text-stone-600">
              Ele já foi usado, venceu (vale 7 dias) ou foi substituído por um mais novo. Peça um link novo ao administrador da cantina.
            </p>
            <Link href="/login" className="botao-sec mt-6 w-full">Ir para o login</Link>
          </>
        )}
      </div>
    </main>
  );
}
