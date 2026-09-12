import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { AppError } from "../../src/shared/errors/AppErrors";
import { errorHandler } from "../../src/shared/middlewares/errorHandler";

/** Response falsa: guarda o status e o corpo que o handler tentou mandar. */
function respostaFalsa() {
  const registro = { status: 0, corpo: undefined as unknown };
  const res = {
    status(codigo: number) {
      registro.status = codigo;
      return this;
    },
    json(corpo: unknown) {
      registro.corpo = corpo;
      return this;
    },
  } as unknown as Response;

  return { res, registro };
}

function tratar(err: unknown) {
  const { res, registro } = respostaFalsa();
  errorHandler(err, {} as Request, res, (() => {}) as NextFunction);
  return registro;
}

describe("AppError", () => {
  it("é um Error de verdade, com a mensagem preservada", () => {
    const erro = new AppError("Livro não encontrado", 404);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe("Livro não encontrado");
  });

  it("usa 400 quando o status não é informado", () => {
    expect(new AppError("Dados inválidos").statusCode).toBe(400);
  });

  it("guarda o status que recebeu", () => {
    expect(new AppError("Sem permissão", 403).statusCode).toBe(403);
  });
});

describe("middlewares/errorHandler", () => {
  beforeEach(() => {
    // O caso 500 loga o erro; silencia para a saída do teste não virar ruído.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responde o status e a mensagem de um AppError", () => {
    const registro = tratar(new AppError("Livro não encontrado", 404));

    expect(registro.status).toBe(404);
    expect(registro.corpo).toEqual({ error: { message: "Livro não encontrado" } });
  });

  it("não vaza code nem issues num AppError", () => {
    const registro = tratar(new AppError("Sem permissão", 403));

    expect(registro.corpo).toEqual({ error: { message: "Sem permissão" } });
  });

  it("vira 400 com issues por campo quando o zod reclama", () => {
    const esquema = z.object({ titulo: z.string().min(1), paginas: z.number() });
    const erro = esquema.safeParse({ titulo: "", paginas: "dez" }).error as ZodError;

    const registro = tratar(erro);

    expect(registro.status).toBe(400);
    expect(registro.corpo).toMatchObject({
      error: { message: "Dados inválidos", code: "VALIDACAO" },
    });
    const { issues } = (registro.corpo as { error: { issues: { campo: string }[] } }).error;
    expect(issues.map((i) => i.campo).sort()).toEqual(["paginas", "titulo"]);
  });

  it("junta o caminho aninhado do zod num campo só", () => {
    const esquema = z.object({ filtro: z.object({ status: z.enum(["lendo"]) }) });
    const erro = esquema.safeParse({ filtro: { status: "x" } }).error as ZodError;

    const registro = tratar(erro);

    const { issues } = (registro.corpo as { error: { issues: { campo: string }[] } }).error;
    expect(issues.at(0)?.campo).toBe("filtro.status");
  });

  it("esconde erro inesperado atrás de um 500 genérico", () => {
    const registro = tratar(new Error("connect ECONNREFUSED 127.0.0.1:5432"));

    expect(registro.status).toBe(500);
    expect(registro.corpo).toEqual({
      error: { message: "Erro interno do servidor", code: "ERRO_INTERNO" },
    });
    expect(JSON.stringify(registro.corpo)).not.toContain("ECONNREFUSED");
  });

  it("loga o erro inesperado, para ele não sumir do servidor", () => {
    const erro = new Error("falha qualquer");

    tratar(erro);

    expect(console.error).toHaveBeenCalledWith(erro);
  });

  it("trata o que nem é Error como erro interno", () => {
    expect(tratar("string solta").status).toBe(500);
    expect(tratar(undefined).status).toBe(500);
    expect(tratar({ message: "objeto cru" }).status).toBe(500);
  });
});
