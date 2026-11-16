import { jwtVerify, SignJWT } from "jose";

export const COOKIE_SESSAO = "cantina_sessao";
export const DURACAO_SESSAO_HORAS = 12;

export type Perfil = "admin" | "voluntario";

export type Sessao = {
  uid: number;
  nome: string;
  perfil: Perfil;
};

let chaveDerivada: Promise<Uint8Array> | undefined;

/**
 * Chave que assina o login. Usa SESSION_SECRET quando configurado; senão deriva uma do endereço
 * do banco (também secreto e só do servidor), para a publicação precisar de uma variável só.
 */
async function chave(): Promise<Uint8Array> {
  const segredo = process.env.SESSION_SECRET?.trim();
  if (segredo) return new TextEncoder().encode(segredo);
  const banco = process.env.DATABASE_URL?.trim();
  if (banco) {
    chaveDerivada ??= crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`cantina-sessao:${banco}`))
      .then((h) => new Uint8Array(h));
    return chaveDerivada;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Configure DATABASE_URL (e, se quiser, SESSION_SECRET).");
  return new TextEncoder().encode("dev-somente-local-troque-em-producao-0000");
}

export async function assinarSessao(s: Sessao): Promise<string> {
  return new SignJWT({ nome: s.nome, perfil: s.perfil })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.uid))
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_HORAS}h`)
    .sign(await chave());
}

export async function lerSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await chave(), { algorithms: ["HS256"] });
    return {
      uid: Number(payload.sub),
      nome: String(payload.nome),
      perfil: payload.perfil === "admin" ? "admin" : "voluntario",
    };
  } catch {
    return null;
  }
}
