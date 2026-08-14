import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppErrors";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ errir: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: "Erro interno do servidor" });
}
