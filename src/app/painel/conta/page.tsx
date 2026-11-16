import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { salvarMeuNome, trocarSenha } from "./actions";

export const metadata = { title: "Minha conta — Painel" };

export default async function ContaPage() {
  const usuario = await exigirUsuario();
  const [u] = await (await getDb()).select({ nome: schema.usuarios.nome, email: schema.usuarios.email }).from(schema.usuarios).where(eq(schema.usuarios.id, usuario.uid));

  return (
    <div className="max-w-md space-y-6">
      <Cabecalho titulo="Minha conta" descricao={`${u.email} · ${usuario.perfil === "admin" ? "Administrador" : "Voluntário"}`} />

      <section className="cartao">
        <h2 className="font-titulos text-lg font-bold text-marinho">Meu nome</h2>
        <ActionForm action={salvarMeuNome} botao="Salvar nome" className="mt-3">
          <Campo rotulo="Nome"><input name="nome" className="campo" required maxLength={80} defaultValue={u.nome} /></Campo>
        </ActionForm>
      </section>

      <section className="cartao">
        <h2 className="font-titulos text-lg font-bold text-marinho">Trocar minha senha</h2>
        <ActionForm action={trocarSenha} botao="Trocar senha" className="mt-3">
          <div className="space-y-4">
            <Campo rotulo="Senha atual"><input name="atual" type="password" className="campo" autoComplete="current-password" required /></Campo>
            <Campo rotulo="Nova senha (mín. 8, com letras e números)"><input name="nova" type="password" minLength={8} className="campo" autoComplete="new-password" required /></Campo>
            <Campo rotulo="Repita a nova senha"><input name="confirmacao" type="password" minLength={8} className="campo" autoComplete="new-password" required /></Campo>
          </div>
        </ActionForm>
        <p className="mt-3 text-xs text-stone-500">Esqueceu a senha atual? Peça ao administrador um link para criar uma nova.</p>
      </section>
    </div>
  );
}
