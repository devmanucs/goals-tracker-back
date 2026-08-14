import bcrypt from "bcryptjs";
import { AppError } from "../../shared/errors/AppErrors";
import jwt from "jsonwebtoken"
import { authRepository } from "./auth.repository";
import { LoginInput, RegisterInput } from "./auth.schema";

const JWT_SECRET = process.env.JWT_SECRET;

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

    const token = jwt.sign({ usuarioId: usuario.id }, JWT_SECRET as string, { expiresIn: "7d" });

    return {token}
  }
};
