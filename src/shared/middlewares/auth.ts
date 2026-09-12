import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authRepository } from "../../features/auth/auth.repository";
import { AppError } from "../errors/AppErrors";
import { env } from "../config/env";

/** Dados do token já validado, anexados à request. */
export interface TokenAutenticado {
  usuarioId: string;
  /** Id único do token. Ausente em tokens antigos, assinados antes do logout existir. */
  jti?: string;
  /** Momento de expiração, derivado do claim `exp`. */
  expiraEm?: Date;
}

// Declaration merging: torna req.usuarioId e req.token visíveis para todos os
// controllers sem precisar de cast em cada handler.
declare global {
  namespace Express {
    interface Request {
      usuarioId?: string;
      token?: TokenAutenticado;
    }
  }
}

/** Formato do payload que o authService assina no login. */
interface TokenPayload {
  usuarioId: string;
  jti?: string;
  exp?: number;
}

/**
 * Lê o header `Authorization: Bearer <token>`, valida o JWT, confere se ele não
 * foi revogado por um logout e injeta `req.usuarioId` e `req.token`.
 *
 * Toda rota que lê ou escreve dados de um usuário precisa passar por aqui — o
 * isolamento multiusuário depende disso.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Token não informado", 401));
  }

  const token = header.slice("Bearer ".length).trim();

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return next(new AppError("Token inválido ou expirado", 401));
  }

  // Fora do try acima de propósito: um erro de banco aqui é 500, não 401.
  if (payload.jti && (await authRepository.tokenEstaRevogado(payload.jti))) {
    return next(new AppError("Sessão encerrada; faça login novamente", 401));
  }

  req.usuarioId = payload.usuarioId;
  req.token = {
    usuarioId: payload.usuarioId,
    ...(payload.jti ? { jti: payload.jti } : {}),
    ...(payload.exp ? { expiraEm: new Date(payload.exp * 1000) } : {}),
  };

  return next();
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

/** Idem, para quando o controller precisa do token inteiro (ex: logout). */
export function tokenAutenticado(req: Request): TokenAutenticado {
  if (!req.token) {
    throw new AppError("Não autenticado", 401);
  }
  return req.token;
}
