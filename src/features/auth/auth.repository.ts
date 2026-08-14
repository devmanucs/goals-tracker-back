import { prisma } from "../../shared/lib/prisma";

export const authRepository = {
  findByEmail: (email: string) => {
    return prisma.usuario.findUnique({
      where: {
        email,
      },
    });
  },

  create(data: { nome: string; email: string; senha: string }) {
    return prisma.usuario.create({
      data,
    });
  },
};
