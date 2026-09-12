import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppErrors";

/**
 * Handler de erro único da aplicação. Formato de resposta combinado com o
 * frontend (ver docs/INTEGRACAO.md no repo do front):
 * `{ error: { message: string, code?: string, issues?: [...] } }`.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Falha de validação do zod (body/params/query fora do contrato).
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Dados inválidos",
        code: "VALIDACAO",
        issues: err.issues.map((issue) => ({
          campo: issue.path.join("."),
          mensagem: issue.message,
        })),
      },
    });
  }

  // Erro de negócio esperado, lançado pelos services.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { message: "Erro interno do servidor", code: "ERRO_INTERNO" },
  });
}
