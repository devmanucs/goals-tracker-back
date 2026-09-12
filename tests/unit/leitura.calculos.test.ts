import { describe, expect, it } from "vitest";
import {
  calcularPaginasLidas,
  calcularRitmoMedio,
} from "../../src/features/leitura/leitura.service";

describe("leitura — páginas lidas", () => {
  it("conta o avanço (delta), não a página absoluta", () => {
    // Três registros no mesmo livro: 20 -> 41 -> 68 = 68 páginas lidas, não 129.
    const paginas = calcularPaginasLidas([
      { livroId: "l1", data: "2026-08-02", paginaAtual: 20 },
      { livroId: "l1", data: "2026-08-05", paginaAtual: 41 },
      { livroId: "l1", data: "2026-08-09", paginaAtual: 68 },
    ]);
    expect(paginas).toBe(68);
  });

  it("soma os deltas de livros diferentes de forma independente", () => {
    const paginas = calcularPaginasLidas([
      { livroId: "l1", data: "2026-08-02", paginaAtual: 20 },
      { livroId: "l2", data: "2026-08-03", paginaAtual: 100 },
      { livroId: "l1", data: "2026-08-05", paginaAtual: 41 },
    ]);
    expect(paginas).toBe(141);
  });

  it("ignora regressão de página (releitura não desconta)", () => {
    const paginas = calcularPaginasLidas([
      { livroId: "l1", data: "2026-08-02", paginaAtual: 80 },
      { livroId: "l1", data: "2026-08-03", paginaAtual: 50 },
      { livroId: "l1", data: "2026-08-04", paginaAtual: 90 },
    ]);
    expect(paginas).toBe(90);
  });

  it("não depende da ordem em que os registros chegam", () => {
    const desordenados = calcularPaginasLidas([
      { livroId: "l1", data: "2026-08-09", paginaAtual: 68 },
      { livroId: "l1", data: "2026-08-02", paginaAtual: 20 },
      { livroId: "l1", data: "2026-08-05", paginaAtual: 41 },
    ]);
    expect(desordenados).toBe(68);
  });

  it("devolve 0 sem registros", () => {
    expect(calcularPaginasLidas([])).toBe(0);
  });
});

describe("leitura — ritmo médio", () => {
  it("divide as páginas pelos dias com registro", () => {
    // 68 páginas em 3 dias distintos.
    const ritmo = calcularRitmoMedio([
      { livroId: "l1", data: "2026-08-02", paginaAtual: 20 },
      { livroId: "l1", data: "2026-08-05", paginaAtual: 41 },
      { livroId: "l1", data: "2026-08-09", paginaAtual: 68 },
    ]);
    expect(ritmo).toBeCloseTo(22.7, 1);
  });

  it("conta um dia só quando há dois registros na mesma data", () => {
    const ritmo = calcularRitmoMedio([
      { livroId: "l1", data: "2026-08-02", paginaAtual: 20 },
      { livroId: "l2", data: "2026-08-02", paginaAtual: 30 },
    ]);
    expect(ritmo).toBe(50);
  });

  it("não divide por zero sem registros", () => {
    expect(calcularRitmoMedio([])).toBe(0);
  });
});
