import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/AppErrors";

const JWT_SECRET = process.env.JWT_SECRET;

// Declaration merging: torna req.usuarioId visível para todos os controllers
// sem precisar de cast em cada handler.
declare global {
  namespace Express {
    interface Request {
      usuarioId?: string;
    }
  }
}

/** Formato do payload que o authService assina no login. */
interface TokenPayload {
  usuarioId: string;
}

/**
 * Lê o header `Authorization: Bearer <token>`, valida o JWT e injeta
 * `req.usuarioId`. Toda rota que lê ou escreve dados de um usuário precisa
 * passar por aqui — o isolamento multiusuário depende disso.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Token não informado", 401));
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as TokenPayload;
    req.usuarioId = payload.usuarioId;
    return next();
  } catch {
    return next(new AppError("Token inválido ou expirado", 401));
  }
}

/**
 * Lê o usuário autenticado de forma type-safe. Os controllers usam isto em vez
 * de `req.usuarioId!` para nunca vazarem `undefined` até a camada de service.
 */
export function usuarioAutenticado(req: Request): string {
  if (!req.usuarioId) {
    throw new AppError("Não autenticado", 401);
  }
  return req.usuarioId;
}
