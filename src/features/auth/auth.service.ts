import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors/AppErrors";
import jwt from "jsonwebtoken"
import { authRepository } from "./auth.repository";
import { LoginInput, RegisterInput } from "./auth.schema";
import { env } from "../../shared/config/env";

export const authService = {
  async register({ nome, email, senha }: RegisterInput) {
    const usuarioExistente = await authRepository.findByEmail(email);
    if (usuarioExistente) {
      throw new AppError("Email já cadastrado", 409);
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await authRepository.create({
      nome,
      email,
      senha: senhaHash,
    });

    return { id: usuario.id, nome: usuario.nome, email: usuario.email };
  },

  async login ({ email, senha} : LoginInput) {
    const usuario = await authRepository.findByEmail(email);
    if (!usuario) {
        throw new AppError("Verifique suas credenciais", 401);
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
        throw new AppError("Verifique suas credenciais", 401);
    }

    // O jwtid (jti) é o que torna o logout possível: é por ele que o token
    // entra na lista de revogados.
    const token = jwt.sign({ usuarioId: usuario.id }, env.JWT_SECRET, {
      expiresIn: "7d",
      jwtid: randomUUID(),
    });

    return {token}
  },

  /** Dados do usuário do token — GET /auth/me. */
  async me(usuarioId: string) {
    const usuario = await authRepository.findById(usuarioId);
    if (!usuario) {
      // O token é válido mas o usuário sumiu (conta apagada).
      throw new AppError("Usuário não encontrado", 404);
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      createdAt: usuario.createdAt.toISOString(),
    };
  },

  /**
   * Invalida o token atual — POST /auth/logout.
   *
   * Só o token usado na requisição é revogado; outros dispositivos do mesmo
   * usuário seguem logados. Tokens antigos, assinados antes do jti existir,
   * não têm como ser revogados — eles simplesmente expiram.
   */
  async logout(token: { jti?: string; usuarioId: string; expiraEm?: Date }) {
    if (!token.jti || !token.expiraEm) {
      throw new AppError(
        "Este token não pode ser revogado; faça login novamente para obter um token novo",
        400,
      );
    }

    await authRepository.revogarToken({
      jti: token.jti,
      usuarioId: token.usuarioId,
      expiraEm: token.expiraEm,
    });

    // Aproveita a operação para limpar revogações já vencidas, evitando que a
    // tabela cresça para sempre sem precisar de job agendado.
    await authRepository.limparExpirados(new Date());
  },
};
