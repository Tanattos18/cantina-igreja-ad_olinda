import { getDb } from "@/db";
import { TIPOS_CHAVE_PIX } from "@/db/schema";
import { exigirAdmin } from "@/lib/auth";
import { lerConfiguracao, pixConfigurado } from "@/lib/config";
import { ROTULO_CHAVE, telefoneBR } from "@/lib/dominio";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { InputImagem } from "@/components/input-imagem";
import { urlImagem } from "@/lib/imagens";
import { salvarConfiguracao } from "./actions";

export const metadata = { title: "Configurações — Painel" };

export default async function ConfiguracoesPage() {
  await exigirAdmin();
  const c = await lerConfiguracao(await getDb());

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Configurações" descricao="O que aparece na página da cantina e para onde vai o Pix." />
      <ActionForm action={salvarConfiguracao} botao="Salvar configurações" className="space-y-6">
        <section className="cartao">
          <h2 className="font-titulos text-lg font-bold text-marinho">Cantina e igreja</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <InputImagem name="logo" rotulo="Logo da igreja (de preferência PNG com fundo transparente)" atual={urlImagem(c.logoId)} maximo={512} />
            </div>
            <Campo rotulo="Nome da cantina"><input name="nome" className="campo" required maxLength={60} defaultValue={c.nome} /></Campo>
            <Campo rotulo="Nome da igreja"><input name="igreja" className="campo" maxLength={100} defaultValue={c.igreja ?? ""} /></Campo>
            <Campo rotulo="Frase da igreja" className="sm:col-span-2"><input name="mensagem" className="campo" maxLength={120} defaultValue={c.mensagem ?? ""} /></Campo>
            <Campo rotulo="Endereço" className="sm:col-span-2"><input name="endereco" className="campo" maxLength={200} defaultValue={c.endereco ?? ""} /></Campo>
            <Campo rotulo="Cultos"><input name="cultos" className="campo" maxLength={120} defaultValue={c.cultos ?? ""} placeholder="Domingo 18h30 · Quarta 20h" /></Campo>
            <Campo rotulo="Instagram (sem @)"><input name="instagram" className="campo" maxLength={60} defaultValue={c.instagram ?? ""} /></Campo>
          </div>
        </section>

        <section className="cartao">
          <h2 className="font-titulos text-lg font-bold text-marinho">Pix e WhatsApp</h2>
          <p className="mt-1 text-sm text-stone-500">
            Com o Pix preenchido, o cliente pode pagar pelo site: aparece o QR code com o valor exato do pedido, direto na conta da igreja, sem taxa.
            A equipe confere o comprovante e marca como pago.
          </p>
          <p className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${pixConfigurado(c) ? "bg-green-100 text-green-800" : "bg-amarelo-claro text-amber-900"}`}>
            {pixConfigurado(c) ? "Pix pelo site ligado" : "Pix pelo site desligado: só pagamento na retirada"}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Tipo da chave">
              <select name="pixTipo" className="campo" defaultValue={c.pixTipo ?? ""}>
                <option value="">Escolha…</option>
                {TIPOS_CHAVE_PIX.map((t) => <option key={t} value={t}>{ROTULO_CHAVE[t]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Chave Pix"><input name="pixChave" className="campo" maxLength={100} defaultValue={c.pixChave ?? ""} autoComplete="off" /></Campo>
            <Campo rotulo="Nome de quem recebe (como no banco)"><input name="pixNome" className="campo" maxLength={60} defaultValue={c.pixNome ?? ""} /></Campo>
            <Campo rotulo="Cidade de quem recebe"><input name="pixCidade" className="campo" maxLength={40} defaultValue={c.pixCidade ?? ""} placeholder="Goiânia" /></Campo>
            <Campo rotulo="WhatsApp da cantina (recebe os comprovantes)" className="sm:col-span-2">
              <input name="whatsapp" type="tel" className="campo" maxLength={30} defaultValue={telefoneBR(c.whatsapp)} placeholder="(62) 99999-0000" />
            </Campo>
          </div>
        </section>
      </ActionForm>
    </div>
  );
}
