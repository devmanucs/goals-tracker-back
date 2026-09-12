import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../../src/shared/errors/AppErrors";
import {
  authMiddleware,
  tokenAutenticado,
  usuarioAutenticado,
} from "../../src/shared/middlewares/auth";
import { authRepository } from "../../src/features/auth/auth.repository";

const SEGREDO = process.env.JWT_SECRET as string;

function requisicao(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as Request;
}

/** Roda o middleware e devolve a request mutada e o que foi passado ao next. */
async function rodar(authorization?: string) {
  const req = requisicao(authorization);
  const next = vi.fn<(erro?: unknown) => void>();
  await authMiddleware(req, {} as Response, next as unknown as NextFunction);
  return { req, erro: next.mock.calls.at(0)?.at(0) };
}

beforeEach(() => {
  // Por padrão nenhum token está revogado; cada teste sobrescreve se precisar.
  vi.spyOn(authRepository, "tokenEstaRevogado").mockResolvedValue(false);
});

describe("middlewares/auth", () => {
  it("recusa requisição sem header Authorization", async () => {
    const { erro } = await rodar();

    expect(erro).toBeInstanceOf(AppError);
    expect(erro).toMatchObject({ message: "Token não informado", statusCode: 401 });
  });

  it("recusa header que não é Bearer", async () => {
    const { erro } = await rodar("Basic dXNlcjpzZW5oYQ==");

    expect(erro).toMatchObject({ message: "Token não informado", statusCode: 401 });
  });

  it("recusa token assinado com outro segredo", async () => {
    const token = jwt.sign({ usuarioId: "u1" }, "outro-segredo");

    const { erro } = await rodar(`Bearer ${token}`);

    expect(erro).toMatchObject({ message: "Token inválido ou expirado", statusCode: 401 });
  });

  it("recusa token expirado", async () => {
    const token = jwt.sign({ usuarioId: "u1" }, SEGREDO, { expiresIn: "-1s" });

    const { erro } = await rodar(`Bearer ${token}`);

    expect(erro).toMatchObject({ message: "Token inválido ou expirado", statusCode: 401 });
  });

  it("recusa lixo no lugar do token", async () => {
    const { erro } = await rodar("Bearer nao-e-um-jwt");

    expect(erro).toMatchObject({ statusCode: 401 });
  });

  it("injeta o usuarioId de um token válido", async () => {
    const token = jwt.sign({ usuarioId: "u1" }, SEGREDO);

    const { req, erro } = await rodar(`Bearer ${token}`);

    expect(erro).toBeUndefined();
    expect(req.usuarioId).toBe("u1");
    expect(req.token?.usuarioId).toBe("u1");
  });

  it("deriva expiraEm do claim exp", async () => {
    const token = jwt.sign({ usuarioId: "u1" }, SEGREDO, { expiresIn: "1h" });

    const { req } = await rodar(`Bearer ${token}`);

    const daquiUmaHora = Date.now() + 60 * 60 * 1000;
    expect(req.token?.expiraEm).toBeInstanceOf(Date);
    expect(Math.abs((req.token?.expiraEm as Date).getTime() - daquiUmaHora)).toBeLessThan(5000);
  });

  it("aceita token antigo, sem jti, sem consultar a denylist", async () => {
    const token = jwt.sign({ usuarioId: "u1" }, SEGREDO, { noTimestamp: true });

    const { req, erro } = await rodar(`Bearer ${token}`);

    expect(erro).toBeUndefined();
    expect(req.token?.jti).toBeUndefined();
    expect(authRepository.tokenEstaRevogado).not.toHaveBeenCalled();
  });

  it("recusa token revogado por logout, mesmo válido e no prazo", async () => {
    vi.spyOn(authRepository, "tokenEstaRevogado").mockResolvedValue(true);
    const token = jwt.sign({ usuarioId: "u1", jti: "t-123" }, SEGREDO);

    const { req, erro } = await rodar(`Bearer ${token}`);

    expect(erro).toMatchObject({
      message: "Sessão encerrada; faça login novamente",
      statusCode: 401,
    });
    expect(req.usuarioId).toBeUndefined();
  });

  it("consulta a denylist pelo jti do token", async () => {
    const token = jwt.sign({ usuarioId: "u1", jti: "t-123" }, SEGREDO);

    await rodar(`Bearer ${token}`);

    expect(authRepository.tokenEstaRevogado).toHaveBeenCalledWith("t-123");
  });

  it("deixa falha de banco virar 500, e não 401", async () => {
    // O catch do jwt.verify não pode engolir erro de infraestrutura.
    vi.spyOn(authRepository, "tokenEstaRevogado").mockRejectedValue(new Error("banco fora"));
    const token = jwt.sign({ usuarioId: "u1", jti: "t-123" }, SEGREDO);

    await expect(rodar(`Bearer ${token}`)).rejects.toThrow("banco fora");
  });

  it("ignora espaço em volta do token", async () => {
    const token = jwt.sign({ usuarioId: "u1" }, SEGREDO);

    const { req, erro } = await rodar(`Bearer  ${token}  `);

    expect(erro).toBeUndefined();
    expect(req.usuarioId).toBe("u1");
  });
});

describe("usuarioAutenticado", () => {
  it("devolve o id quando o middleware já rodou", () => {
    expect(usuarioAutenticado({ usuarioId: "u1" } as Request)).toBe("u1");
  });

  it("lança 401 em vez de deixar undefined chegar no service", () => {
    expect(() => usuarioAutenticado({} as Request)).toThrow(AppError);
    expect(() => usuarioAutenticado({} as Request)).toThrow("Não autenticado");
  });
});

describe("tokenAutenticado", () => {
  it("devolve o token inteiro", () => {
    const token = { usuarioId: "u1", jti: "t-1" };

    expect(tokenAutenticado({ token } as Request)).toBe(token);
  });

  it("lança 401 quando não há token na request", () => {
    expect(() => tokenAutenticado({} as Request)).toThrow("Não autenticado");
  });
});
