import type { SituacaoVenda } from "@/db/schema";
import { mudarSituacao } from "./actions";

/** "Abrir a cantina" publica a venda no link da loja; "Fechar a cantina" encerra. */
export function BotaoSituacao({ vendaId, situacao, grande }: { vendaId: number; situacao: SituacaoVenda; grande?: boolean }) {
  return (
    <form action={mudarSituacao}>
      <input type="hidden" name="id" value={vendaId} />
      {situacao === "aberta" ? (
        <button name="situacao" value="encerrada" className={`botao-perigo ${grande ? "px-5 py-3 text-base" : ""}`}>
          Fechar a cantina
        </button>
      ) : (
        <button name="situacao" value="aberta" className={`botao bg-green-700 hover:bg-green-800 ${grande ? "px-5 py-3 text-base" : ""}`}>
          🟢 Abrir a cantina
        </button>
      )}
    </form>
  );
}
