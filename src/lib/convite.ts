import { createHash, randomBytes } from "node:crypto";
import { urlDoSite } from "./config";

/** Quanto tempo o link para criar a senha vale. */
export const DIAS_CONVITE = 7;

export function hashConvite(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Link para a pessoa criar a própria senha. O banco guarda só o hash: quem vê o banco não consegue
 * montar o link, e o painel mostra o link uma única vez (para gerar outro, é só pedir de novo).
 */
export function novoConvite(agora = new Date()) {
  const token = randomBytes(24).toString("base64url");
  return {
    link: `${urlDoSite()}/convite/${token}`,
    conviteHash: hashConvite(token),
    conviteExpiraEm: new Date(agora.getTime() + DIAS_CONVITE * 24 * 3600_000),
  };
}

/** Senha impossível de adivinhar para quem ainda não criou a sua (o login fica fechado até o convite). */
export function senhaInutilizavel(): string {
  return randomBytes(32).toString("base64url");
}

export function mensagemConvite(nome: string, cantina: string): string {
  return `Olá, ${nome.split(" ")[0]}! Você foi cadastrado(a) no painel da ${cantina}. Abra o link para criar sua senha (vale ${DIAS_CONVITE} dias):`;
}
