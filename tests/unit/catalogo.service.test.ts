import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AppError } from "../../src/shared/errors/AppErrors";
import {
  catalogoService,
  definirProvedorDeCatalogo,
} from "../../src/features/leitura/catalogo.service";
import type {
  DetalheDoCatalogo,
  LivroDoCatalogo,
  ProvedorDeCatalogo,
} from "../../src/features/leitura/catalogo.tipos";

const LIVRO: LivroDoCatalogo = {
  chave: "/works/OL27448W",
  titulo: "Duna",
  autor: "Frank Herbert",
  totalPaginas: 688,
  capaUrl: null,
  anoPublicacao: 1965,
  isbn: null,
};

const DETALHE: DetalheDoCatalogo = { ...LIVRO, sinopse: "Arrakis...", assuntos: ["Ficção"] };

/** Provedor de mentira: conta chamadas e nunca toca a rede. */
function provedorFalso() {
  return {
    nome: "falso",
    buscar: vi.fn<ProvedorDeCatalogo["buscar"]>(async () => [LIVRO]),
    detalhar: vi.fn<ProvedorDeCatalogo["detalhar"]>(async () => DETALHE),
  };
}

let provedor: ReturnType<typeof provedorFalso>;

beforeEach(() => {
  provedor = provedorFalso();
  // Também zera cache e limitador, que são singletons do módulo.
  definirProvedorDeCatalogo(provedor);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("catalogoService.buscar", () => {
  it("chama o provedor com o termo e o limite", async () => {
    await catalogoService.buscar("u1", { q: "duna", limite: 5 });

    expect(provedor.buscar).toHaveBeenCalledWith("duna", 5);
  });

  it("diz de qual provedor veio o dado", async () => {
    const resposta = await catalogoService.buscar("u1", { q: "duna", limite: 8 });

    expect(resposta).toMatchObject({ fonte: "falso", cache: false, resultados: [LIVRO] });
  });

  it("na segunda busca igual responde do cache, sem bater no provedor", async () => {
    await catalogoService.buscar("u1", { q: "duna", limite: 8 });
    const segunda = await catalogoService.buscar("u1", { q: "duna", limite: 8 });

    expect(segunda.cache).toBe(true);
    expect(segunda.resultados).toEqual([LIVRO]);
    expect(provedor.buscar).toHaveBeenCalledTimes(1);
  });

  it("trata maiúscula e minúscula como a mesma consulta", async () => {
    await catalogoService.buscar("u1", { q: "Duna", limite: 8 });
    const segunda = await catalogoService.buscar("u1", { q: "duna", limite: 8 });

    expect(segunda.cache).toBe(true);
    expect(provedor.buscar).toHaveBeenCalledTimes(1);
  });

  it("o cache é do app, não do usuário: outra conta aproveita", async () => {
    await catalogoService.buscar("u1", { q: "duna", limite: 8 });
    const deOutro = await catalogoService.buscar("u2", { q: "duna", limite: 8 });

    expect(deOutro.cache).toBe(true);
    expect(provedor.buscar).toHaveBeenCalledTimes(1);
  });

  it("limite diferente é consulta diferente", async () => {
    await catalogoService.buscar("u1", { q: "duna", limite: 8 });
    const outroLimite = await catalogoService.buscar("u1", { q: "duna", limite: 3 });

    expect(outroLimite.cache).toBe(false);
    expect(provedor.buscar).toHaveBeenCalledTimes(2);
  });

  it("consulta de novo depois da validade de uma hora", async () => {
    vi.useFakeTimers();
    await catalogoService.buscar("u1", { q: "duna", limite: 8 });

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    const depois = await catalogoService.buscar("u1", { q: "duna", limite: 8 });

    expect(depois.cache).toBe(false);
    expect(provedor.buscar).toHaveBeenCalledTimes(2);
  });

  it("deixa o erro do provedor subir, sem cachear a falha", async () => {
    provedor.buscar.mockRejectedValueOnce(new AppError("Catálogo indisponível", 503));

    await expect(catalogoService.buscar("u1", { q: "duna", limite: 8 })).rejects.toThrow(
      "Catálogo indisponível",
    );
    await catalogoService.buscar("u1", { q: "duna", limite: 8 });
    expect(provedor.buscar).toHaveBeenCalledTimes(2);
  });
});

describe("catalogoService.detalhar", () => {
  it("devolve o detalhe do provedor", async () => {
    await expect(catalogoService.detalhar("u1", LIVRO.chave)).resolves.toEqual(DETALHE);
  });

  it("cacheia o detalhe entre chamadas", async () => {
    await catalogoService.detalhar("u1", LIVRO.chave);
    await catalogoService.detalhar("u1", LIVRO.chave);

    expect(provedor.detalhar).toHaveBeenCalledTimes(1);
  });

  it("vira 404 quando o provedor não conhece a chave", async () => {
    provedor.detalhar.mockResolvedValue(null);

    const erro = await catalogoService.detalhar("u1", "/works/X").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect(erro).toMatchObject({ message: "Livro não encontrado no catálogo", statusCode: 404 });
  });

  it("lembra do 404 em vez de perguntar de novo", async () => {
    provedor.detalhar.mockResolvedValue(null);

    await catalogoService.detalhar("u1", "/works/X").catch(() => {});
    await expect(catalogoService.detalhar("u1", "/works/X")).rejects.toThrow(
      "Livro não encontrado no catálogo",
    );
    expect(provedor.detalhar).toHaveBeenCalledTimes(1);
  });

  it("não confunde a chave de um livro com a de outro", async () => {
    await catalogoService.detalhar("u1", "/works/A");
    await catalogoService.detalhar("u1", "/works/B");

    expect(provedor.detalhar).toHaveBeenCalledTimes(2);
  });
});

describe("limite de chamadas por usuário", () => {
  it("deixa passar 30 buscas distintas no minuto", async () => {
    for (let i = 0; i < 30; i++) {
      await catalogoService.buscar("u1", { q: `livro${i}`, limite: 8 });
    }

    expect(provedor.buscar).toHaveBeenCalledTimes(30);
  });

  it("barra a 31ª com 429", async () => {
    for (let i = 0; i < 30; i++) {
      await catalogoService.buscar("u1", { q: `livro${i}`, limite: 8 });
    }

    const erro = await catalogoService
      .buscar("u1", { q: "estourou", limite: 8 })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect(erro).toMatchObject({ statusCode: 429 });
  });

  it("conta mesmo quando a resposta veio do cache", async () => {
    // Senão um cliente com bug repetiria a mesma busca à vontade.
    for (let i = 0; i < 30; i++) {
      await catalogoService.buscar("u1", { q: "duna", limite: 8 });
    }

    await expect(catalogoService.buscar("u1", { q: "duna", limite: 8 })).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("conta busca e detalhe no mesmo balde", async () => {
    for (let i = 0; i < 30; i++) {
      await catalogoService.buscar("u1", { q: `livro${i}`, limite: 8 });
    }

    await expect(catalogoService.detalhar("u1", LIVRO.chave)).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("o limite de um usuário não afeta o outro", async () => {
    for (let i = 0; i < 30; i++) {
      await catalogoService.buscar("u1", { q: `livro${i}`, limite: 8 });
    }

    await expect(
      catalogoService.buscar("u2", { q: "duna", limite: 8 }),
    ).resolves.toMatchObject({ fonte: "falso" });
  });

  it("libera de novo quando a janela de um minuto passa", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 30; i++) {
      await catalogoService.buscar("u1", { q: `livro${i}`, limite: 8 });
    }
    await expect(catalogoService.buscar("u1", { q: "x", limite: 8 })).rejects.toMatchObject({
      statusCode: 429,
    });

    vi.advanceTimersByTime(60 * 1000 + 1);

    await expect(catalogoService.buscar("u1", { q: "x", limite: 8 })).resolves.toMatchObject({
      fonte: "falso",
    });
  });
});
