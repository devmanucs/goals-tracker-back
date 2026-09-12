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

async function criarConcurso(usuario: UsuarioDeTeste, extra: Record<string, unknown> = {}) {
  const resposta = await request(app)
    .post("/concursos")
    .set(...usuario.auth)
    .send({
      titulo: "Analista Judiciário — TRT",
      banca: "FGV",
      dataProva: "2026-11-22",
      ...extra,
    });
  return resposta.body;
}

async function criarTopico(
  usuario: UsuarioDeTeste,
  concursoId: string,
  extra: Record<string, unknown> = {},
) {
  const resposta = await request(app)
    .post(`/concursos/${concursoId}/topicos`)
    .set(...usuario.auth)
    .send({
      titulo: "Atos administrativos",
      materia: "Direito Administrativo",
      peso: 10,
      dataAgendada: "2026-08-14",
      ...extra,
    });
  return resposta.body;
}

describe("concursos", () => {
  it("cria um concurso vinculado ao usuário do token", async () => {
    const concurso = await criarConcurso(ana);

    expect(concurso.status).toBe("planejando");
    expect(concurso.dataProva).toBe("2026-11-22");

    const noBanco = await prisma.concurso.findUnique({ where: { id: concurso.id } });
    expect(noBanco?.usuarioId).toBe(ana.id);
  });

  it("lista apenas os concursos do usuário logado", async () => {
    await criarConcurso(ana, { titulo: "Da Ana" });
    await criarConcurso(bruno, { titulo: "Do Bruno" });

    const resposta = await request(app)
      .get("/concursos")
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].titulo).toBe("Da Ana");
  });

  it("devolve 404 para concurso de outro usuário", async () => {
    const concurso = await criarConcurso(ana);

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}`)
      .set(...bruno.auth);

    expect(resposta.status).toBe(404);
  });

  it("deleta o concurso e seus tópicos em cascata", async () => {
    const concurso = await criarConcurso(ana);
    await criarTopico(ana, concurso.id);

    const resposta = await request(app)
      .delete(`/concursos/${concurso.id}`)
      .set(...ana.auth);

    expect(resposta.status).toBe(204);
    expect(await prisma.topicoEstudo.count()).toBe(0);
  });

  it("recusa data de prova fora do formato", async () => {
    const resposta = await request(app)
      .post("/concursos")
      .set(...ana.auth)
      .send({ titulo: "X", banca: "Y", dataProva: "22/11/2026" });

    expect(resposta.status).toBe(400);
  });
});

describe("tópicos", () => {
  it("ordena por data por padrão", async () => {
    const concurso = await criarConcurso(ana);
    await criarTopico(ana, concurso.id, { titulo: "Segundo", dataAgendada: "2026-08-15", peso: 10 });
    await criarTopico(ana, concurso.id, { titulo: "Primeiro", dataAgendada: "2026-08-13", peso: 3 });

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}/topicos`)
      .set(...ana.auth);

    expect(resposta.body.map((t: { titulo: string }) => t.titulo)).toEqual([
      "Primeiro",
      "Segundo",
    ]);
  });

  it("ordena por peso decrescente com ?ordenarPor=peso", async () => {
    const concurso = await criarConcurso(ana);
    await criarTopico(ana, concurso.id, { titulo: "Leve", peso: 3, dataAgendada: "2026-08-13" });
    await criarTopico(ana, concurso.id, { titulo: "Pesado", peso: 10, dataAgendada: "2026-08-20" });
    await criarTopico(ana, concurso.id, { titulo: "Médio", peso: 6, dataAgendada: "2026-08-15" });

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}/topicos?ordenarPor=peso`)
      .set(...ana.auth);

    expect(resposta.body.map((t: { titulo: string }) => t.titulo)).toEqual([
      "Pesado",
      "Médio",
      "Leve",
    ]);
  });

  it("filtra por status", async () => {
    const concurso = await criarConcurso(ana);
    await criarTopico(ana, concurso.id, { titulo: "Feito", status: "estudado" });
    await criarTopico(ana, concurso.id, { titulo: "A fazer", status: "pendente" });

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}/topicos?status=estudado`)
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].titulo).toBe("Feito");
  });

  it("troca o status pelo PATCH /topicos/:id", async () => {
    const concurso = await criarConcurso(ana);
    const topico = await criarTopico(ana, concurso.id);

    const resposta = await request(app)
      .patch(`/topicos/${topico.id}`)
      .set(...ana.auth)
      .send({ status: "revisao" });

    expect(resposta.status).toBe(200);
    expect(resposta.body.status).toBe("revisao");
  });

  it("recusa peso fora da faixa 1-10", async () => {
    const concurso = await criarConcurso(ana);

    const resposta = await request(app)
      .post(`/concursos/${concurso.id}/topicos`)
      .set(...ana.auth)
      .send({
        titulo: "X",
        materia: "Y",
        peso: 42,
        dataAgendada: "2026-08-14",
      });

    expect(resposta.status).toBe(400);
  });

  it("não deixa alterar tópico de outro usuário", async () => {
    const concurso = await criarConcurso(ana);
    const topico = await criarTopico(ana, concurso.id);

    const resposta = await request(app)
      .patch(`/topicos/${topico.id}`)
      .set(...bruno.auth)
      .send({ status: "estudado" });

    expect(resposta.status).toBe(404);
  });
});

describe("visão calendário", () => {
  it("agrupa tópicos por dataAgendada", async () => {
    const concurso = await criarConcurso(ana);
    await criarTopico(ana, concurso.id, { titulo: "A", dataAgendada: "2026-08-13" });
    await criarTopico(ana, concurso.id, { titulo: "B", dataAgendada: "2026-08-13" });
    await criarTopico(ana, concurso.id, { titulo: "C", dataAgendada: "2026-08-15" });

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}/calendario`)
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toHaveLength(2);
    expect(resposta.body[0]).toMatchObject({ data: "2026-08-13", total: 2 });
    expect(resposta.body[1]).toMatchObject({ data: "2026-08-15", total: 1 });
  });

  it("respeita a janela de/ate", async () => {
    const concurso = await criarConcurso(ana);
    await criarTopico(ana, concurso.id, { titulo: "Fora", dataAgendada: "2026-07-01" });
    await criarTopico(ana, concurso.id, { titulo: "Dentro", dataAgendada: "2026-08-13" });

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}/calendario?de=2026-08-01&ate=2026-08-31`)
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].data).toBe("2026-08-13");
  });

  it("o calendário geral cobre todos os concursos do usuário", async () => {
    const primeiro = await criarConcurso(ana, { titulo: "Um" });
    const segundo = await criarConcurso(ana, { titulo: "Dois" });
    await criarTopico(ana, primeiro.id, { dataAgendada: "2026-08-13" });
    await criarTopico(ana, segundo.id, { dataAgendada: "2026-08-13" });

    const resposta = await request(app)
      .get("/estudos/calendario")
      .set(...ana.auth);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].total).toBe(2);
  });
});

describe("derivados", () => {
  it("calcula o progresso contando estudado e revisão", async () => {
    const concurso = await criarConcurso(ana);
    await criarTopico(ana, concurso.id, { titulo: "1", status: "estudado" });
    await criarTopico(ana, concurso.id, { titulo: "2", status: "revisao" });
    await criarTopico(ana, concurso.id, { titulo: "3", status: "pendente" });

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}/progresso`)
      .set(...ana.auth);

    expect(resposta.body).toMatchObject({ total: 3, concluidos: 2, percentual: 67 });
  });

  it("devolve os dias até a prova", async () => {
    const concurso = await criarConcurso(ana, { dataProva: "2026-11-22" });

    const resposta = await request(app)
      .get(`/concursos/${concurso.id}/dias-ate-prova`)
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body.dataProva).toBe("2026-11-22");
    expect(typeof resposta.body.dias).toBe("number");
  });

  it("o próximo tópico ignora os já estudados", async () => {
    const concurso = await criarConcurso(ana);
    const daquiA10 = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const daquiA20 = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);

    await criarTopico(ana, concurso.id, {
      titulo: "Já estudado",
      dataAgendada: daquiA10,
      status: "estudado",
    });
    await criarTopico(ana, concurso.id, {
      titulo: "A estudar",
      dataAgendada: daquiA20,
      status: "pendente",
    });

    const resposta = await request(app)
      .get("/estudos/proximo-topico")
      .set(...ana.auth);

    expect(resposta.body.titulo).toBe("A estudar");
    expect(resposta.body.concurso.titulo).toBe("Analista Judiciário — TRT");
  });

  it("devolve null quando não há próximo tópico", async () => {
    const resposta = await request(app)
      .get("/estudos/proximo-topico")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toBeNull();
  });
});
