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

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const daquiA = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe("GET /dashboard", () => {
  it("exige autenticação", async () => {
    const resposta = await request(app).get("/dashboard");
    expect(resposta.status).toBe(401);
  });

  it("devolve a estrutura completa mesmo com a conta vazia", async () => {
    const resposta = await request(app)
      .get("/dashboard")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      leitura: { livroAtual: null, livrosLidos: 0 },
      estudos: { proximoTopico: null, concursosAtivos: 0 },
      habitos: { total: 0, streaksAtivos: [], metasBatidasNoPeriodo: 0 },
    });
  });

  it("agrega livro em andamento, próximo tópico e streaks ativos", async () => {
    // --- Leitura ---
    const livro = await request(app)
      .post("/livros")
      .set(...ana.auth)
      .send({ titulo: "Duna", autor: "Frank Herbert", totalPaginas: 688, status: "lendo" });
    await request(app)
      .post(`/livros/${livro.body.id}/registros`)
      .set(...ana.auth)
      .send({ data: hoje(), paginaAtual: 344 });

    // --- Estudos ---
    const concurso = await request(app)
      .post("/concursos")
      .set(...ana.auth)
      .send({ titulo: "TRT", banca: "FGV", dataProva: daquiA(90), status: "estudando" });
    await request(app)
      .post(`/concursos/${concurso.body.id}/topicos`)
      .set(...ana.auth)
      .send({
        titulo: "Atos administrativos",
        materia: "Direito Administrativo",
        peso: 10,
        dataAgendada: daquiA(2),
      });

    // --- Hábitos ---
    const habito = await request(app)
      .post("/habitos")
      .set(...ana.auth)
      .send({ nome: "Beber água", unidade: "L", metaValor: 2 });
    for (const dias of [1, 0]) {
      await request(app)
        .post(`/habitos/${habito.body.id}/registros`)
        .set(...ana.auth)
        .send({ data: diasAtras(dias), valor: 2.5 });
    }

    const resposta = await request(app)
      .get("/dashboard")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);

    expect(resposta.body.leitura.livroAtual).toMatchObject({
      titulo: "Duna",
      paginaAtual: 344,
      percentual: 50,
    });

    expect(resposta.body.estudos.proximoTopico).toMatchObject({
      titulo: "Atos administrativos",
    });
    expect(resposta.body.estudos.concursosAtivos).toBe(1);

    expect(resposta.body.habitos.streaksAtivos).toHaveLength(1);
    expect(resposta.body.habitos.streaksAtivos[0]).toMatchObject({
      nome: "Beber água",
      streak: 2,
    });
    expect(resposta.body.habitos.metasBatidasNoPeriodo).toBe(1);
  });

  it("não mistura dados de outro usuário", async () => {
    await request(app)
      .post("/livros")
      .set(...bruno.auth)
      .send({ titulo: "Do Bruno", autor: "X", totalPaginas: 100, status: "lendo" });

    const resposta = await request(app)
      .get("/dashboard")
      .set(...ana.auth);

    expect(resposta.body.leitura.livroAtual).toBeNull();
  });

  it("omite hábitos sem streak da lista de streaks ativos", async () => {
    await request(app)
      .post("/habitos")
      .set(...ana.auth)
      .send({ nome: "Correr", unidade: "km", metaValor: 5 });

    const resposta = await request(app)
      .get("/dashboard")
      .set(...ana.auth);

    expect(resposta.body.habitos.total).toBe(1);
    expect(resposta.body.habitos.streaksAtivos).toEqual([]);
  });
});
