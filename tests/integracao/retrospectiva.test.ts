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

async function livroComRegistro(usuario: UsuarioDeTeste, paginaAtual: number) {
  const livro = await request(app)
    .post("/livros")
    .set(...usuario.auth)
    .send({ titulo: "Duna", autor: "Frank Herbert", totalPaginas: 688, status: "lido" });

  await request(app)
    .post(`/livros/${livro.body.id}/registros`)
    .set(...usuario.auth)
    .send({ data: hoje(), paginaAtual });

  return livro.body;
}

describe("GET /retrospectiva", () => {
  it("exige autenticação", async () => {
    const resposta = await request(app).get("/retrospectiva");
    expect(resposta.status).toBe(401);
  });

  it("usa 6 meses por padrão", async () => {
    const resposta = await request(app)
      .get("/retrospectiva")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body.meses).toBe(6);
    expect(resposta.body.paginasLidasPorMes).toHaveLength(6);
    expect(resposta.body.topicosEstudadosPorMes).toHaveLength(6);
    expect(resposta.body.habitosConcluidosPorMes).toHaveLength(6);
  });

  it("respeita ?meses=12", async () => {
    const resposta = await request(app)
      .get("/retrospectiva?meses=12")
      .set(...ana.auth);

    expect(resposta.body.meses).toBe(12);
    expect(resposta.body.paginasLidasPorMes).toHaveLength(12);
  });

  it("recusa meses fora da faixa", async () => {
    for (const valor of ["0", "61", "abc"]) {
      const resposta = await request(app)
        .get(`/retrospectiva?meses=${valor}`)
        .set(...ana.auth);
      expect(resposta.status).toBe(400);
    }
  });

  it("devolve a estrutura completa com a conta vazia", async () => {
    const resposta = await request(app)
      .get("/retrospectiva?meses=1")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body.resumo).toEqual({
      livrosLidos: 0,
      paginasLidas: 0,
      topicosEstudados: 0,
      maiorStreak: 0,
    });
    expect(resposta.body.paginasLidasPorMes[0].paginas).toBe(0);
  });

  it("cada ponto das séries tem o formato que o recharts espera", async () => {
    const resposta = await request(app)
      .get("/retrospectiva?meses=1")
      .set(...ana.auth);

    expect(Object.keys(resposta.body.paginasLidasPorMes[0]).sort()).toEqual([
      "mes",
      "paginas",
    ]);
    expect(Object.keys(resposta.body.topicosEstudadosPorMes[0]).sort()).toEqual([
      "mes",
      "topicos",
    ]);
    expect(Object.keys(resposta.body.habitosConcluidosPorMes[0]).sort()).toEqual([
      "mes",
      "percentual",
    ]);
  });

  it("agrega leitura, estudos e hábitos do usuário", async () => {
    await livroComRegistro(ana, 300);

    const concurso = await request(app)
      .post("/concursos")
      .set(...ana.auth)
      .send({ titulo: "TRT", banca: "FGV", dataProva: "2026-11-22" });
    await request(app)
      .post(`/concursos/${concurso.body.id}/topicos`)
      .set(...ana.auth)
      .send({
        titulo: "Atos administrativos",
        materia: "Direito Administrativo",
        peso: 10,
        dataAgendada: hoje(),
        status: "estudado",
      });

    const habito = await request(app)
      .post("/habitos")
      .set(...ana.auth)
      .send({ nome: "Beber água", unidade: "L", metaValor: 2 });
    await request(app)
      .post(`/habitos/${habito.body.id}/registros`)
      .set(...ana.auth)
      .send({ data: hoje(), valor: 2.5 });

    const resposta = await request(app)
      .get("/retrospectiva?meses=1")
      .set(...ana.auth);

    expect(resposta.body.resumo).toMatchObject({
      livrosLidos: 1,
      paginasLidas: 300,
      topicosEstudados: 1,
      maiorStreak: 1,
    });
    expect(resposta.body.paginasLidasPorMes[0].paginas).toBe(300);
    expect(resposta.body.topicosEstudadosPorMes[0].topicos).toBe(1);
    expect(resposta.body.habitosConcluidosPorMes[0].percentual).toBe(100);
  });

  it("não mistura dados de outro usuário", async () => {
    await livroComRegistro(bruno, 500);

    const resposta = await request(app)
      .get("/retrospectiva?meses=1")
      .set(...ana.auth);

    expect(resposta.body.resumo.livrosLidos).toBe(0);
    expect(resposta.body.resumo.paginasLidas).toBe(0);
  });
});
