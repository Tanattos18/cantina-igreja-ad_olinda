import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { alternarAcesso, criarUsuario, definirSenhaProvisoria, editarUsuario, gerarConvite } from "./actions";

export const metadata = { title: "Equipe — Painel" };

const PERFIL = { admin: "Administrador", voluntario: "Voluntário" } as const;

export default async function EquipePage() {
  const admin = await exigirAdmin();
  const db = await getDb();
  const agora = new Date();
  const usuarios = await db.select().from(schema.usuarios).orderBy(asc(schema.usuarios.nome));

  return (
    <div className="max-w-4xl">
      <Cabecalho
        titulo="Equipe"
        descricao="Cadastre quem ajuda na cantina. A pessoa recebe um link no WhatsApp e cria a própria senha. Administrador: tudo. Voluntário: pedidos, balcão, vendas e cardápio."
      />

      <section className="cartao mb-6">
        <h2 className="font-titulos text-lg font-bold text-marinho">+ Cadastrar pessoa</h2>
        <ActionForm action={criarUsuario} botao="Cadastrar e gerar link" className="mt-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Nome"><input name="nome" className="campo" required maxLength={80} /></Campo>
            <Campo rotulo="E-mail (usado para entrar)"><input name="email" type="email" className="campo" required /></Campo>
            <Campo rotulo="Perfil">
              <select name="perfil" className="campo" defaultValue="voluntario">
                <option value="voluntario">Voluntário</option>
                <option value="admin">Administrador</option>
              </select>
            </Campo>
          </div>
        </ActionForm>
      </section>

      <ul className="space-y-3">
        {usuarios.map((u) => {
          const eu = u.id === admin.uid;
          const convitePendente = !!u.conviteHash && !!u.conviteExpiraEm;
          const conviteVencido = convitePendente && u.conviteExpiraEm! < agora;
          return (
            <li key={u.id} className={`cartao p-4 ${u.ativo ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marinho font-titulos text-lg font-bold text-amarelo">
                  {u.nome.trim()[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {u.nome} {eu && <span className="text-xs font-normal text-stone-500">(você)</span>}
                  </p>
                  <p className="text-sm text-stone-500">
                    {u.email} · {PERFIL[u.perfil]}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold">
                    {!u.ativo ? (
                      <span className="text-red-700">Acesso desativado</span>
                    ) : conviteVencido ? (
                      <span className="text-red-700">Link para criar a senha venceu: gere outro</span>
                    ) : convitePendente ? (
                      <span className="text-amber-800">Aguardando a pessoa criar a senha pelo link</span>
                    ) : u.trocarSenha ? (
                      <span className="text-amber-800">Senha provisória: troca no próximo acesso</span>
                    ) : (
                      <span className="text-green-700">Senha criada</span>
                    )}
                  </p>
                </div>
                {!eu && (
                  <form action={alternarAcesso}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="ativo" value={String(!u.ativo)} />
                    <button className={u.ativo ? "botao-perigo" : "botao-sec"}>{u.ativo ? "Desativar acesso" : "Reativar acesso"}</button>
                  </form>
                )}
              </div>

              <details className="mt-3 border-t border-[#f1ebe1] pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-marinho">Editar dados e senha</summary>
                <ActionForm action={editarUsuario} botao="Salvar dados" botaoClasse="botao-sec" className="mt-3">
                  <input type="hidden" name="id" value={u.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Campo rotulo="Nome"><input name="nome" className="campo" required maxLength={80} defaultValue={u.nome} /></Campo>
                    <Campo rotulo="E-mail"><input name="email" type="email" className="campo" required defaultValue={u.email} /></Campo>
                    <Campo rotulo="Perfil">
                      <select name="perfil" className="campo" defaultValue={u.perfil} disabled={eu}>
                        <option value="voluntario">Voluntário</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </Campo>
                  </div>
                </ActionForm>

                {!eu && (
                  <div className="mt-4 rounded-xl bg-stone-50 p-3">
                    <p className="text-sm font-semibold">Senha</p>
                    <p className="text-xs text-stone-500">Gere um link e mande para a pessoa criar (ou trocar) a própria senha. O link vale 7 dias.</p>
                    <ActionForm action={gerarConvite} botao="Gerar link para criar a senha" botaoClasse="botao" className="[&>div]:mt-2">
                      <input type="hidden" name="id" value={u.id} />
                    </ActionForm>
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-xs text-stone-500">Sem WhatsApp? Definir uma senha provisória</summary>
                      <ActionForm action={definirSenhaProvisoria} botao="Definir" botaoClasse="botao-sec" className="mt-2 [&>div]:mt-2">
                        <input type="hidden" name="id" value={u.id} />
                        <input name="senha" type="text" minLength={8} className="campo max-w-xs" required autoComplete="off" placeholder="Senha provisória (8+, letras e números)" aria-label="Senha provisória" />
                      </ActionForm>
                    </details>
                  </div>
                )}
                {eu && <p className="mt-3 text-xs text-stone-500">Sua senha você troca em <a href="/painel/conta" className="link">Minha conta</a>.</p>}
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
