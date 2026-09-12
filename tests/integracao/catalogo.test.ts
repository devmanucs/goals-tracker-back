import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/shared/lib/prisma";
import { definirProvedorDeCatalogo } from "../../src/features/leitura/catalogo.service";
import { AppError } from "../../src/shared/errors/AppErrors";
import type { ProvedorDeCatalogo } from "../../src/features/leitura/catalogo.tipos";
import { criarUsuario, limparBanco, UsuarioDeTeste } from "../helpers";

let ana: UsuarioDeTeste;

/** Provedor falso: as rotas são testadas sem tocar a rede. */
function provedorFalso(overrides: Partial<ProvedorDeCatalogo> = {}) {
  const chamadas = { buscar: 0, detalhar: 0 };

  const provedor: ProvedorDeCatalogo = {
    nome: "falso",
    async buscar(termo, limite) {
      chamadas.buscar++;
      return Array.from({ length: Math.min(limite, 3) }, (_, i) => ({
        chave: `/works/OL${i}W`,
        titulo: `${termo} ${i}`,
        autor: "Autora Teste",
        totalPaginas: 100 + i,
        capaUrl: `https://capas.test/${i}.jpg`,
        anoPublicacao: 2020 + i,
        isbn: `978000000000${i}`,
      }));
    },
    async detalhar(chave) {
      chamadas.detalhar++;
      if (chave.includes("INEXISTENTE")) return null;
      return {
        chave,
        titulo: "Duna",
        autor: null,
        totalPaginas: null,
        capaUrl: "https://capas.test/duna-L.jpg",
        anoPublicacao: null,
        isbn: null,
        sinopse: "Em um futuro distante...",
        assuntos: ["Ficção científica"],
      };
    },
    ...overrides,
  };

  definirProvedorDeCatalogo(provedor);
  return chamadas;
}

beforeEach(async () => {
  await limparBanco();
  ana = await criarUsuario("ana");
  provedorFalso();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /livros/buscar-externo", () => {
  it("exige autenticação", async () => {
    const resposta = await request(app).get("/livros/buscar-externo?q=duna");
    expect(resposta.status).toBe(401);
  });

  it("devolve os resultados normalizados", async () => {
    const resposta = await request(app)
      .get("/livros/buscar-externo?q=duna")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body.fonte).toBe("falso");
    expect(resposta.body.resultados).toHaveLength(3);
    expect(resposta.body.resultados[0]).toMatchObject({
      titulo: "duna 0",
      autor: "Autora Teste",
      totalPaginas: 100,
    });
  });

  it("não confunde a rota com um id de livro", async () => {
    // "/livros/:id" viria depois; se a ordem das rotas quebrar, aqui dá 404.
    const resposta = await request(app)
      .get("/livros/buscar-externo?q=duna")
      .set(...ana.auth);
    expect(resposta.status).toBe(200);
  });

  it("recusa termo curto demais", async () => {
    const resposta = await request(app)
      .get("/livros/buscar-externo?q=a")
      .set(...ana.auth);

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe("VALIDACAO");
  });

  it("recusa limite acima do teto", async () => {
    const resposta = await request(app)
      .get("/livros/buscar-externo?q=duna&limite=500")
      .set(...ana.auth);
    expect(resposta.status).toBe(400);
  });

  it("respeita o limite pedido", async () => {
    const resposta = await request(app)
      .get("/livros/buscar-externo?q=duna&limite=2")
      .set(...ana.auth);
    expect(resposta.body.resultados).toHaveLength(2);
  });

  it("serve a segunda busca igual do cache, sem chamar o provedor de novo", async () => {
    const chamadas = provedorFalso();

    const primeira = await request(app)
      .get("/livros/buscar-externo?q=duna")
      .set(...ana.auth);
    const segunda = await request(app)
      .get("/livros/buscar-externo?q=DUNA")
      .set(...ana.auth);

    expect(primeira.body.cache).toBe(false);
    expect(segunda.body.cache).toBe(true);
    // A segunda difere só por caixa: é a mesma consulta.
    expect(chamadas.buscar).toBe(1);
  });

  it("traduz indisponibilidade do provedor em 503", async () => {
    provedorFalso({
      async buscar(): Promise<never> {
        throw new AppError("catálogo fora do ar", 503);
      },
    });

    const resposta = await request(app)
      .get("/livros/buscar-externo?q=duna")
      .set(...ana.auth);

    expect(resposta.status).toBe(503);
  });

  it("corta o usuário que dispara busca demais", async () => {
    // Limite é 30 por minuto; cada termo distinto escapa do cache.
    let ultima = 200;
    for (let i = 0; i < 32 && ultima === 200; i++) {
      const r = await request(app)
        .get(`/livros/buscar-externo?q=termo-${i}`)
        .set(...ana.auth);
      ultima = r.status;
    }
    expect(ultima).toBe(429);
  });
});

describe("GET /livros/buscar-externo/detalhe", () => {
  it("devolve a sinopse do livro escolhido", async () => {
    const resposta = await request(app)
      .get("/livros/buscar-externo/detalhe?chave=%2Fworks%2FOL27448W")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      titulo: "Duna",
      sinopse: "Em um futuro distante...",
      assuntos: ["Ficção científica"],
    });
  });

  it("devolve 404 para chave que o provedor não conhece", async () => {
    const resposta = await request(app)
      .get("/livros/buscar-externo/detalhe?chave=%2Fworks%2FINEXISTENTE")
      .set(...ana.auth);

    expect(resposta.status).toBe(404);
  });

  it("exige autenticação", async () => {
    const resposta = await request(app).get("/livros/buscar-externo/detalhe?chave=%2Fworks%2FOL1W");
    expect(resposta.status).toBe(401);
  });
});

describe("cadastro a partir do catálogo", () => {
  it("guarda capa, sinopse, isbn e ano junto do livro", async () => {
    const resposta = await request(app)
      .post("/livros")
      .set(...ana.auth)
      .send({
        titulo: "Duna",
        autor: "Frank Herbert",
        totalPaginas: 688,
        status: "lendo",
        capaUrl: "https://covers.openlibrary.org/b/id/12345-M.jpg",
        sinopse: "Em um futuro distante...",
        isbn: "9780441172719",
        anoPublicacao: 1965,
      });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({
      capaUrl: "https://covers.openlibrary.org/b/id/12345-M.jpg",
      sinopse: "Em um futuro distante...",
      isbn: "9780441172719",
      anoPublicacao: 1965,
    });
  });

  it("segue aceitando cadastro manual, sem nenhum campo de catálogo", async () => {
    const resposta = await request(app)
      .post("/livros")
      .set(...ana.auth)
      .send({ titulo: "Caderno", autor: "Eu", totalPaginas: 50 });

    expect(resposta.status).toBe(201);
    expect(resposta.body.capaUrl).toBeNull();
    expect(resposta.body.sinopse).toBeNull();
  });

  it("recusa capaUrl que não é URL", async () => {
    const resposta = await request(app)
      .post("/livros")
      .set(...ana.auth)
      .send({ titulo: "X", autor: "Y", totalPaginas: 10, capaUrl: "não-é-url" });

    expect(resposta.status).toBe(400);
  });
});
