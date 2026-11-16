import { ActionForm } from "@/components/action-form";
import { Campo } from "@/components/ui";
import { Logo } from "@/components/marca";
import { entrar } from "./actions";

export const metadata = { title: "Painel da cantina" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-marinho p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl">
        <Logo nome="AD Olinda" tamanho={56} />
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
      </div>
    </main>
  );
}
