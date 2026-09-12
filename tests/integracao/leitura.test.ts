import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/shared/lib/prisma";
import { criarUsuario, limparBanco, UsuarioDeTeste } from "../helpers";

let ana: UsuarioDeTeste;
let bruno: UsuarioDeTeste;

beforeEach(async () => {
  await limparBanco();
  ana = await criarUsuario("ana");
  bruno = await criarUsuario("bruno");
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function criarLivro(usuario: UsuarioDeTeste, extra: Record<string, unknown> = {}) {
  const resposta = await request(app)
    .post("/livros")
    .set(...usuario.auth)
    .send({ titulo: "Duna", autor: "Frank Herbert", totalPaginas: 688, ...extra });
  return resposta.body;
}

describe("POST /livros", () => {
  it("cria um livro vinculado ao usuário do token", async () => {
    const resposta = await request(app)
      .post("/livros")
      .set(...ana.auth)
      .send({ titulo: "Duna", autor: "Frank Herbert", totalPaginas: 688, status: "lendo" });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ titulo: "Duna", status: "lendo" });

    const noBanco = await prisma.livro.findUnique({ where: { id: resposta.body.id } });
    expect(noBanco?.usuarioId).toBe(ana.id);
  });

  it("assume status 'quero_ler' quando não informado", async () => {
    const livro = await criarLivro(ana);
    expect(livro.status).toBe("quero_ler");
  });

  it("rejeita payload inválido com 400 e a lista de problemas", async () => {
    const resposta = await request(app)
      .post("/livros")
      .set(...ana.auth)
      .send({ titulo: "", autor: "X", totalPaginas: -5 });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe("VALIDACAO");
    expect(resposta.body.error.issues.length).toBeGreaterThan(0);
  });

  it("exige autenticação", async () => {
    const resposta = await request(app).post("/livros").send({ titulo: "X" });
    expect(resposta.status).toBe(401);
  });

  it("rejeita token inválido", async () => {
    const resposta = await request(app)
      .get("/livros")
      .set("Authorization", "Bearer token-falso");
    expect(resposta.status).toBe(401);
  });
});

describe("GET /livros", () => {
  it("lista apenas os livros do usuário logado", async () => {
    await criarLivro(ana, { titulo: "Livro da Ana" });
    await criarLivro(bruno, { titulo: "Livro do Bruno" });

    const resposta = await request(app)
      .get("/livros")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].titulo).toBe("Livro da Ana");
  });

  it("filtra por status", async () => {
    await criarLivro(ana, { titulo: "Lendo", status: "lendo" });
    await criarLivro(ana, { titulo: "Quero ler", status: "quero_ler" });

    const resposta = await request(app)
      .get("/livros?status=lendo")
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].titulo).toBe("Lendo");
  });
});

describe("isolamento entre usuários", () => {
  it("devolve 404 ao buscar livro de outro usuário", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .get(`/livros/${livro.id}`)
      .set(...bruno.auth);

    expect(resposta.status).toBe(404);
  });

  it("devolve 404 ao tentar editar livro de outro usuário", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .patch(`/livros/${livro.id}`)
      .set(...bruno.auth)
      .send({ status: "abandonado" });

    expect(resposta.status).toBe(404);
    // E o livro segue intacto.
    const noBanco = await prisma.livro.findUnique({ where: { id: livro.id } });
    expect(noBanco?.status).toBe("QUERO_LER");
  });

  it("devolve 404 ao tentar deletar livro de outro usuário", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .delete(`/livros/${livro.id}`)
      .set(...bruno.auth);

    expect(resposta.status).toBe(404);
    expect(await prisma.livro.count()).toBe(1);
  });

  it("não deixa criar registro em livro de outro usuário", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .post(`/livros/${livro.id}/registros`)
      .set(...bruno.auth)
      .send({ data: "2026-08-13", paginaAtual: 10 });

    expect(resposta.status).toBe(404);
  });
});

describe("PATCH e DELETE /livros/:id", () => {
  it("atualiza o status do livro", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .patch(`/livros/${livro.id}`)
      .set(...ana.auth)
      .send({ status: "lido" });

    expect(resposta.status).toBe(200);
    expect(resposta.body.status).toBe("lido");
  });

  it("recusa PATCH com corpo vazio", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .patch(`/livros/${livro.id}`)
      .set(...ana.auth)
      .send({});

    expect(resposta.status).toBe(400);
  });

  it("deleta o livro e seus registros em cascata", async () => {
    const livro = await criarLivro(ana);
    await request(app)
      .post(`/livros/${livro.id}/registros`)
      .set(...ana.auth)
      .send({ data: "2026-08-13", paginaAtual: 10 });

    const resposta = await request(app)
      .delete(`/livros/${livro.id}`)
      .set(...ana.auth);

    expect(resposta.status).toBe(204);
    expect(await prisma.registroLeitura.count()).toBe(0);
  });
});

describe("registros de leitura", () => {
  it("cria e lista registros em ordem cronológica", async () => {
    const livro = await criarLivro(ana);

    for (const registro of [
      { data: "2026-08-09", paginaAtual: 68 },
      { data: "2026-08-02", paginaAtual: 20 },
      { data: "2026-08-05", paginaAtual: 41 },
    ]) {
      await request(app)
        .post(`/livros/${livro.id}/registros`)
        .set(...ana.auth)
        .send(registro);
    }

    const resposta = await request(app)
      .get(`/livros/${livro.id}/registros`)
      .set(...ana.auth);

    expect(resposta.body.map((r: { data: string }) => r.data)).toEqual([
      "2026-08-02",
      "2026-08-05",
      "2026-08-09",
    ]);
  });

  it("devolve a data no formato YYYY-MM-DD, sem timestamp", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .post(`/livros/${livro.id}/registros`)
      .set(...ana.auth)
      .send({ data: "2026-08-13", paginaAtual: 42 });

    expect(resposta.body.data).toBe("2026-08-13");
  });

  it("recusa página maior que o total do livro", async () => {
    const livro = await criarLivro(ana, { totalPaginas: 100 });

    const resposta = await request(app)
      .post(`/livros/${livro.id}/registros`)
      .set(...ana.auth)
      .send({ data: "2026-08-13", paginaAtual: 500 });

    expect(resposta.status).toBe(400);
  });

  it("recusa data fora do formato", async () => {
    const livro = await criarLivro(ana);

    const resposta = await request(app)
      .post(`/livros/${livro.id}/registros`)
      .set(...ana.auth)
      .send({ data: "13/08/2026", paginaAtual: 10 });

    expect(resposta.status).toBe(400);
  });
});

describe("GET /leitura/estatisticas", () => {
  it("calcula páginas lidas por delta e ritmo médio", async () => {
    const livro = await criarLivro(ana, { totalPaginas: 688, status: "lendo" });

    for (const registro of [
      { data: "2026-08-02", paginaAtual: 20 },
      { data: "2026-08-05", paginaAtual: 41 },
      { data: "2026-08-09", paginaAtual: 68 },
    ]) {
      await request(app)
        .post(`/livros/${livro.id}/registros`)
        .set(...ana.auth)
        .send(registro);
    }

    const resposta = await request(app)
      .get("/leitura/estatisticas")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body.paginasLidasTotal).toBe(68);
    expect(resposta.body.diasComRegistro).toBe(3);
    expect(resposta.body.livrosLendo).toBe(1);
  });

  it("respeita a janela de período informada", async () => {
    const livro = await criarLivro(ana);

    for (const registro of [
      { data: "2026-07-01", paginaAtual: 50 },
      { data: "2026-08-10", paginaAtual: 120 },
    ]) {
      await request(app)
        .post(`/livros/${livro.id}/registros`)
        .set(...ana.auth)
        .send(registro);
    }

    const resposta = await request(app)
      .get("/leitura/estatisticas?de=2026-08-01&ate=2026-08-31")
      .set(...ana.auth);

    // Só o registro de agosto entra: 120 páginas contadas do zero na janela.
    expect(resposta.body.paginasLidasTotal).toBe(120);
    expect(resposta.body.periodo).toEqual({ de: "2026-08-01", ate: "2026-08-31" });
  });

  it("não mistura dados de outro usuário", async () => {
    const livroBruno = await criarLivro(bruno);
    await request(app)
      .post(`/livros/${livroBruno.id}/registros`)
      .set(...bruno.auth)
      .send({ data: "2026-08-10", paginaAtual: 300 });

    const resposta = await request(app)
      .get("/leitura/estatisticas")
      .set(...ana.auth);

    expect(resposta.body.paginasLidasTotal).toBe(0);
  });
});

describe("página atual embutida no livro", () => {
  it("vem zerada em livro sem registro", async () => {
    const livro = await criarLivro(ana);
    expect(livro).toMatchObject({ paginaAtual: 0, percentual: 0, ultimaLeitura: null });
  });

  it("reflete o registro mais recente, não o primeiro", async () => {
    const livro = await criarLivro(ana, { totalPaginas: 688 });

    for (const registro of [
      { data: "2026-08-02", paginaAtual: 20 },
      { data: "2026-08-09", paginaAtual: 344 },
      { data: "2026-08-05", paginaAtual: 100 },
    ]) {
      await request(app)
        .post(`/livros/${livro.id}/registros`)
        .set(...ana.auth)
        .send(registro);
    }

    const resposta = await request(app)
      .get(`/livros/${livro.id}`)
      .set(...ana.auth);

    expect(resposta.body).toMatchObject({
      paginaAtual: 344,
      percentual: 50,
      ultimaLeitura: "2026-08-09",
    });
  });

  it("aparece também na listagem, sem precisar de uma busca por livro", async () => {
    const livro = await criarLivro(ana, { totalPaginas: 100 });
    await request(app)
      .post(`/livros/${livro.id}/registros`)
      .set(...ana.auth)
      .send({ data: "2026-08-13", paginaAtual: 25 });

    const resposta = await request(app)
      .get("/livros")
      .set(...ana.auth);

    expect(resposta.body[0]).toMatchObject({ paginaAtual: 25, percentual: 25 });
  });
});
