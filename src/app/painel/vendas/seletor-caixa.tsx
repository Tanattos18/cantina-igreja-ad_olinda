import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { telefoneBR } from "@/lib/dominio";
import { ActionForm } from "@/components/action-form";
import { definirCaixa } from "./actions";

/**
 * Quem está no caixa desta venda: os clientes mandam o comprovante do Pix para o WhatsApp dessa pessoa.
 * Começa com quem abriu a cantina; dá para trocar (escala de domingo).
 */
export async function SeletorCaixa({ vendaId, caixaUsuarioId, reserva }: { vendaId: number; caixaUsuarioId: number | null; reserva: string | null }) {
  const db = await getDb();
  const equipe = await db
    .select({ id: schema.usuarios.id, nome: schema.usuarios.nome, whatsapp: schema.usuarios.whatsapp })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.ativo, true))
    .orderBy(asc(schema.usuarios.nome));
  const atual = equipe.find((u) => u.id === caixaUsuarioId);
  const numero = atual?.whatsapp ?? reserva;

  return (
    <section className="cartao mb-6 p-4">
      <ActionForm action={definirCaixa} botao="Salvar caixa" botaoClasse="botao-sec py-2" className="flex flex-wrap items-end gap-3 [&>div]:mt-0">
        <input type="hidden" name="vendaId" value={vendaId} />
        <label className="min-w-56 flex-1">
          <span className="rotulo">Caixa desta venda (recebe os comprovantes de Pix)</span>
          <select name="caixaUsuarioId" className="campo" defaultValue={caixaUsuarioId ?? ""}>
            <option value="">Ninguém (usar o WhatsApp reserva)</option>
            {equipe.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} {u.whatsapp ? `· ${telefoneBR(u.whatsapp)}` : "· sem WhatsApp"}
              </option>
            ))}
          </select>
        </label>
      </ActionForm>
      <p className={`mt-2 text-xs font-semibold ${numero ? "text-green-800" : "text-red-700"}`}>
        {numero ? (
          <>Comprovantes vão para {atual?.whatsapp ? atual.nome : "o WhatsApp reserva"}: {telefoneBR(numero)}</>
        ) : (
          <>
            Ninguém vai receber os comprovantes: {atual ? `${atual.nome} ainda não cadastrou o WhatsApp` : "escolha o caixa"}. Cada pessoa coloca o número em{" "}
            <Link href="/painel/conta" className="underline">Minha conta</Link>.
          </>
        )}
      </p>
    </section>
  );
}
