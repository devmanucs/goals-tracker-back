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

/** Data de hoje — o streak e o progresso são sempre relativos a ela. */
const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function criarHabito(usuario: UsuarioDeTeste, extra: Record<string, unknown> = {}) {
  const resposta = await request(app)
    .post("/habitos")
    .set(...usuario.auth)
    .send({ nome: "Beber água", unidade: "L", metaValor: 2, ...extra });
  return resposta.body;
}

async function registrar(
  usuario: UsuarioDeTeste,
  habitoId: string,
  data: string,
  valor: number,
) {
  return request(app)
    .post(`/habitos/${habitoId}/registros`)
    .set(...usuario.auth)
    .send({ data, valor });
}

describe("hábitos — CRUD", () => {
  it("cria um hábito vinculado ao usuário do token", async () => {
    const habito = await criarHabito(ana, { frequencia: "semanal", metaValor: 15, unidade: "km" });

    expect(habito).toMatchObject({ frequencia: "semanal", metaValor: 15, unidade: "km" });

    const noBanco = await prisma.habito.findUnique({ where: { id: habito.id } });
    expect(noBanco?.usuarioId).toBe(ana.id);
  });

  it("assume frequência diária quando não informada", async () => {
    const habito = await criarHabito(ana);
    expect(habito.frequencia).toBe("diaria");
  });

  it("lista apenas os hábitos do usuário logado", async () => {
    await criarHabito(ana, { nome: "Da Ana" });
    await criarHabito(bruno, { nome: "Do Bruno" });

    const resposta = await request(app)
      .get("/habitos")
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].nome).toBe("Da Ana");
  });

  it("recusa meta zero ou negativa", async () => {
    const resposta = await request(app)
      .post("/habitos")
      .set(...ana.auth)
      .send({ nome: "X", unidade: "L", metaValor: 0 });

    expect(resposta.status).toBe(400);
  });

  it("recusa PATCH com corpo vazio", async () => {
    const habito = await criarHabito(ana);

    const resposta = await request(app)
      .patch(`/habitos/${habito.id}`)
      .set(...ana.auth)
      .send({});

    expect(resposta.status).toBe(400);
  });

  it("deleta o hábito e seus registros em cascata", async () => {
    const habito = await criarHabito(ana);
    await registrar(ana, habito.id, hoje(), 1);

    const resposta = await request(app)
      .delete(`/habitos/${habito.id}`)
      .set(...ana.auth);

    expect(resposta.status).toBe(204);
    expect(await prisma.registroHabito.count()).toBe(0);
  });

  it("devolve 404 para hábito de outro usuário", async () => {
    const habito = await criarHabito(ana);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}`)
      .set(...bruno.auth);

    expect(resposta.status).toBe(404);
  });
});

describe("registros de hábito", () => {
  it("aceita vários registros no mesmo dia", async () => {
    const habito = await criarHabito(ana);
    await registrar(ana, habito.id, hoje(), 1.5);
    await registrar(ana, habito.id, hoje(), 0.7);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/registros`)
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(2);
  });

  it("não deixa registrar em hábito de outro usuário", async () => {
    const habito = await criarHabito(ana);

    const resposta = await registrar(bruno, habito.id, hoje(), 1);
    expect(resposta.status).toBe(404);
  });

  it("filtra registros por janela de data", async () => {
    const habito = await criarHabito(ana);
    await registrar(ana, habito.id, diasAtras(30), 1);
    await registrar(ana, habito.id, hoje(), 1);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/registros?de=${diasAtras(5)}`)
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(1);
  });

  it("recusa valor negativo", async () => {
    const habito = await criarHabito(ana);
    const resposta = await registrar(ana, habito.id, hoje(), -1);
    expect(resposta.status).toBe(400);
  });
});

describe("progresso do período vigente", () => {
  it("soma os registros de hoje contra a meta diária", async () => {
    const habito = await criarHabito(ana, { metaValor: 2 });
    await registrar(ana, habito.id, hoje(), 1.5);
    await registrar(ana, habito.id, hoje(), 0.7);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/progresso-atual`)
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      atual: 2.2,
      meta: 2,
      percentual: 100,
      batido: true,
      unidade: "L",
    });
  });

  it("ignora registros de períodos anteriores", async () => {
    const habito = await criarHabito(ana, { metaValor: 2 });
    await registrar(ana, habito.id, diasAtras(5), 99);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/progresso-atual`)
      .set(...ana.auth);

    expect(resposta.body.atual).toBe(0);
    expect(resposta.body.batido).toBe(false);
  });
});

describe("streak", () => {
  it("conta dias consecutivos batendo a meta", async () => {
    const habito = await criarHabito(ana, { metaValor: 2 });
    for (const dias of [2, 1, 0]) {
      await registrar(ana, habito.id, diasAtras(dias), 2.5);
    }

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/streak`)
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body.atual).toBe(3);
    expect(resposta.body.periodoAtualBatido).toBe(true);
  });

  it("não zera o streak quando hoje ainda não bateu a meta", async () => {
    const habito = await criarHabito(ana, { metaValor: 2 });
    await registrar(ana, habito.id, diasAtras(2), 2.5);
    await registrar(ana, habito.id, diasAtras(1), 2.5);
    // Hoje: registro parcial, abaixo da meta.
    await registrar(ana, habito.id, hoje(), 0.5);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/streak`)
      .set(...ana.auth);

    expect(resposta.body.atual).toBe(2);
    expect(resposta.body.periodoAtualBatido).toBe(false);
  });

  it("quebra o streak num buraco no meio", async () => {
    const habito = await criarHabito(ana, { metaValor: 2 });
    await registrar(ana, habito.id, diasAtras(4), 2.5);
    // Dia 3 sem registro nenhum: buraco.
    await registrar(ana, habito.id, diasAtras(1), 2.5);
    await registrar(ana, habito.id, hoje(), 2.5);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/streak`)
      .set(...ana.auth);

    expect(resposta.body.atual).toBe(2);
  });

  it("devolve zero para hábito sem registros", async () => {
    const habito = await criarHabito(ana);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/streak`)
      .set(...ana.auth);

    expect(resposta.body.atual).toBe(0);
    expect(resposta.body.recorde).toBe(0);
  });

  it("não vaza o streak de um hábito de outro usuário", async () => {
    const habito = await criarHabito(ana);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}/streak`)
      .set(...bruno.auth);

    expect(resposta.status).toBe(404);
  });
});

describe("listagem com progresso, streak e registros recentes", () => {
  it("devolve os três derivados junto de cada hábito", async () => {
    const habito = await criarHabito(ana, { metaValor: 2 });
    await registrar(ana, habito.id, diasAtras(1), 2.5);
    await registrar(ana, habito.id, hoje(), 2.5);

    const resposta = await request(app)
      .get("/habitos")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body[0]).toMatchObject({
      nome: "Beber água",
      progresso: { atual: 2.5, meta: 2, batido: true },
      streak: { atual: 2, periodoAtualBatido: true },
    });
    expect(resposta.body[0].registrosRecentes).toHaveLength(2);
  });

  it("recorta os registros recentes em 90 dias", async () => {
    const habito = await criarHabito(ana);
    await registrar(ana, habito.id, diasAtras(200), 1);
    await registrar(ana, habito.id, hoje(), 1);

    const resposta = await request(app)
      .get("/habitos")
      .set(...ana.auth);

    expect(resposta.body[0].registrosRecentes).toHaveLength(1);
    expect(resposta.body[0].registrosRecentes[0].data).toBe(hoje());
  });

  it("hábito sem registro vem com streak zero e lista vazia", async () => {
    await criarHabito(ana);

    const resposta = await request(app)
      .get("/habitos")
      .set(...ana.auth);

    expect(resposta.body[0].streak.atual).toBe(0);
    expect(resposta.body[0].registrosRecentes).toEqual([]);
  });
});

describe("detalhe do hábito", () => {
  it("devolve os mesmos derivados da listagem", async () => {
    const habito = await criarHabito(ana, { metaValor: 2 });
    await registrar(ana, habito.id, hoje(), 2.5);

    const resposta = await request(app)
      .get(`/habitos/${habito.id}`)
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body.progresso).toMatchObject({ atual: 2.5, batido: true });
    expect(resposta.body.streak).toMatchObject({ atual: 1 });
    expect(resposta.body.registrosRecentes).toHaveLength(1);
  });
});
