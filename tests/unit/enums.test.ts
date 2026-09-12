import { describe, expect, it } from "vitest";
import { criarMapeadorDeEnum } from "../../src/shared/utils/enums";

describe("utils/enums", () => {
  const mapa = criarMapeadorDeEnum<"quero_ler" | "lendo", "QUERO_LER" | "LENDO">({
    quero_ler: "QUERO_LER",
    lendo: "LENDO",
  });

  it("converte da API para o banco", () => {
    expect(mapa.paraDb("quero_ler")).toBe("QUERO_LER");
  });

  it("converte do banco para a API", () => {
    expect(mapa.paraApi("LENDO")).toBe("lendo");
  });

  it("é reversível nos dois sentidos", () => {
    expect(mapa.paraApi(mapa.paraDb("lendo"))).toBe("lendo");
  });
});
