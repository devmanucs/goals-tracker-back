import { prisma } from "../../shared/lib/prisma";

export const authRepository = {
  findByEmail: (email: string) => {
    return prisma.usuario.findUnique({
      where: {
        email,
      },
    });
  },

  findById: (id: string) => {
    return prisma.usuario.findUnique({
      where: {
        id,
      },
    });
  },

  create(data: { nome: string; email: string; senha: string }) {
    return prisma.usuario.create({
      data,
    });
  },

  // --------------------------------------------------------------------------
  // Tokens revogados (logout)
  // --------------------------------------------------------------------------

  revogarToken(data: { jti: string; usuarioId: string; expiraEm: Date }) {
    // upsert e não create: um segundo logout com o mesmo token não pode
    // estourar violação de chave primária.
    return prisma.tokenRevogado.upsert({
      where: { jti: data.jti },
      create: data,
      update: {},
    });
  },

  async tokenEstaRevogado(jti: string) {
    const revogado = await prisma.tokenRevogado.findUnique({
      where: { jti },
    });
    return revogado !== null;
  },

  /** Remove as revogações de tokens que já expiraram — elas não servem mais. */
  limparExpirados(agora: Date) {
    return prisma.tokenRevogado.deleteMany({
      where: { expiraEm: { lt: agora } },
    });
  },
};
