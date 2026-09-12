import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/shared/lib/prisma";
import { criarUsuario, limparBanco, UsuarioDeTeste } from "../helpers";

let ana: UsuarioDeTeste;

beforeEach(async () => {
  await limparBanco();
  ana = await criarUsuario("ana");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /auth/me", () => {
  it("devolve os dados do usuário do token", async () => {
    const resposta = await request(app)
      .get("/auth/me")
      .set(...ana.auth);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ id: ana.id, email: ana.email });
    expect(resposta.body.nome).toBe("Usuário ana");
  });

  it("nunca devolve a senha", async () => {
    const resposta = await request(app)
      .get("/auth/me")
      .set(...ana.auth);

    expect(resposta.body).not.toHaveProperty("senha");
  });

  it("exige token", async () => {
    const resposta = await request(app).get("/auth/me");
    expect(resposta.status).toBe(401);
  });

  it("recusa token inválido", async () => {
    const resposta = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer nao-e-um-jwt");

    expect(resposta.status).toBe(401);
  });

  it("devolve 404 se a conta foi apagada mas o token ainda vale", async () => {
    await prisma.usuario.delete({ where: { id: ana.id } });

    const resposta = await request(app)
      .get("/auth/me")
      .set(...ana.auth);

    expect(resposta.status).toBe(404);
  });
});

describe("POST /auth/logout", () => {
  it("responde 204 e invalida o token usado", async () => {
    const logout = await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    expect(logout.status).toBe(204);

    // O mesmo token não pode mais ser usado em lugar nenhum.
    const depois = await request(app)
      .get("/auth/me")
      .set(...ana.auth);

    expect(depois.status).toBe(401);
  });

  it("bloqueia o token revogado nas rotas de dados, não só no auth", async () => {
    await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    const resposta = await request(app)
      .get("/livros")
      .set(...ana.auth);

    expect(resposta.status).toBe(401);
  });

  it("grava a revogação com o jti do token", async () => {
    await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    const revogados = await prisma.tokenRevogado.findMany({
      where: { usuarioId: ana.id },
    });

    expect(revogados).toHaveLength(1);
    expect(revogados[0]?.expiraEm.getTime()).toBeGreaterThan(Date.now());
  });

  it("é idempotente: deslogar duas vezes não estoura", async () => {
    await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    // O segundo logout já é barrado pelo middleware, com 401 e não 500.
    const segundo = await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    expect(segundo.status).toBe(401);
    expect(await prisma.tokenRevogado.count()).toBe(1);
  });

  it("não desloga os outros dispositivos do mesmo usuário", async () => {
    // Segundo login = segundo token, com jti próprio.
    const outroLogin = await request(app)
      .post("/auth/login")
      .send({ email: ana.email, senha: "senha123" });
    const outroToken = `Bearer ${outroLogin.body.token}`;

    await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    const resposta = await request(app)
      .get("/auth/me")
      .set("Authorization", outroToken);

    expect(resposta.status).toBe(200);
  });

  it("não desloga outros usuários", async () => {
    const bruno = await criarUsuario("bruno");

    await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    const resposta = await request(app)
      .get("/auth/me")
      .set(...bruno.auth);

    expect(resposta.status).toBe(200);
  });

  it("exige token", async () => {
    const resposta = await request(app).post("/auth/logout");
    expect(resposta.status).toBe(401);
  });

  it("limpa revogações já expiradas ao deslogar", async () => {
    // Lixo de uma sessão que já venceu: não serve mais para nada.
    await prisma.tokenRevogado.create({
      data: {
        jti: "jti-antigo",
        usuarioId: ana.id,
        expiraEm: new Date(Date.now() - 86400000),
      },
    });

    await request(app)
      .post("/auth/logout")
      .set(...ana.auth);

    const antigo = await prisma.tokenRevogado.findUnique({
      where: { jti: "jti-antigo" },
    });
    expect(antigo).toBeNull();
  });
});

describe("tokens sem jti (assinados antes do logout existir)", () => {
  it("continuam válidos para leitura", async () => {
    const jwt = await import("jsonwebtoken");
    const antigo = jwt.default.sign(
      { usuarioId: ana.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    const resposta = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${antigo}`);

    expect(resposta.status).toBe(200);
  });

  it("mas devolvem 400 explicativo no logout, por não serem revogáveis", async () => {
    const jwt = await import("jsonwebtoken");
    const antigo = jwt.default.sign(
      { usuarioId: ana.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    const resposta = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${antigo}`);

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.message).toMatch(/login novamente/);
  });
});
