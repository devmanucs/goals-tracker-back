import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/shared/lib/prisma";

/** Apaga todos os dados entre testes, respeitando a ordem das FKs. */
export async function limparBanco() {
  await prisma.registroHabito.deleteMany();
  await prisma.habito.deleteMany();
  await prisma.topicoEstudo.deleteMany();
  await prisma.concurso.deleteMany();
  await prisma.registroLeitura.deleteMany();
  await prisma.livro.deleteMany();
  await prisma.usuario.deleteMany();
}

export interface UsuarioDeTeste {
  id: string;
  email: string;
  token: string;
  /** Header pronto para `.set(...)` no supertest. */
  auth: [string, string];
}

/**
 * Cria um usuário via a API real de auth e devolve o token.
 * Passar pelo endpoint (em vez de inserir no banco) garante que o hash de senha
 * e o formato do JWT são exatamente os que a aplicação usa.
 */
export async function criarUsuario(sufixo = "1"): Promise<UsuarioDeTeste> {
  const email = `usuario${sufixo}-${Date.now()}@teste.com`;

  const registro = await request(app)
    .post("/auth/register")
    .send({ nome: `Usuário ${sufixo}`, email, senha: "senha123" });

  const login = await request(app)
    .post("/auth/login")
    .send({ email, senha: "senha123" });

  return {
    id: registro.body.id,
    email,
    token: login.body.token,
    auth: ["Authorization", `Bearer ${login.body.token}`],
  };
}
