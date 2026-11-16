import { describe, expect, it } from "vitest";
import { crc16, gerarPixCopiaECola, normalizarChave } from "./pix";

describe("Pix copia e cola", () => {
  it("CRC16 confere com o exemplo do manual do Banco Central", () => {
    const semCrc =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(semCrc)).toBe("1D3D");
  });

  it("monta o código com chave, valor, nome sem acento e identificador", () => {
    const c = gerarPixCopiaECola({ chave: "+5581999990000", nome: "Igreja Assembléia de Deus", cidade: "Olinda", valor: 23.5, identificador: "CANTINA3P15" });
    expect(c).toContain("0014br.gov.bcb.pix0114+5581999990000");
    expect(c).toContain("540523.50");
    expect(c).toContain("5925IGREJA ASSEMBLEIA DE DEU");
    expect(c).toContain("6006OLINDA");
    expect(c).toContain("62150511CANTINA3P15");
    expect(c.slice(-4)).toBe(crc16(c.slice(0, -4)));
  });

  it("normaliza cada tipo de chave e recusa as inválidas", () => {
    expect(normalizarChave("telefone", "(81) 99999-0000")).toBe("+5581999990000");
    expect(normalizarChave("cpf", "123.456.789-09")).toBe("12345678909");
    expect(normalizarChave("cnpj", "12.345.678/0001-90")).toBe("12345678000190");
    expect(normalizarChave("email", " Cantina@Igreja.org ")).toBe("cantina@igreja.org");
    expect(normalizarChave("aleatoria", "123E4567-E12B-12D1-A456-426655440000")).toBe("123e4567-e12b-12d1-a456-426655440000");
    expect(normalizarChave("cpf", "123")).toBe("");
    expect(normalizarChave("email", "sem-arroba")).toBe("");
  });
});
