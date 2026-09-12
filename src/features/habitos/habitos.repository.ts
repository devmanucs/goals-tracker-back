import { prisma } from "../../shared/lib/prisma";
import { FrequenciaHabito } from "../../../generated/prisma/enums";

/** Só queries Prisma — a validação de posse fica no service. */
export const habitosRepository = {
  // --------------------------------------------------------------------------
  // Hábitos
  // --------------------------------------------------------------------------

  listarHabitos(usuarioId: string) {
    return prisma.habito.findMany({
      where: { usuarioId },
      orderBy: { createdAt: "asc" },
    });
  },

  buscarHabitoPorId(id: string, usuarioId: string) {
    return prisma.habito.findFirst({ where: { id, usuarioId } });
  },

  criarHabito(data: {
    usuarioId: string;
    nome: string;
    unidade: string;
    frequencia: FrequenciaHabito;
    metaValor: number;
    icone?: string;
  }) {
    return prisma.habito.create({ data });
  },

  atualizarHabito(
    id: string,
    data: {
      nome?: string;
      unidade?: string;
      frequencia?: FrequenciaHabito;
      metaValor?: number;
      icone?: string;
    },
  ) {
    return prisma.habito.update({ where: { id }, data });
  },

  deletarHabito(id: string) {
    // Os registros caem junto por causa do onDelete: Cascade.
    return prisma.habito.delete({ where: { id } });
  },

  // --------------------------------------------------------------------------
  // Registros
  // --------------------------------------------------------------------------

  listarRegistrosDoHabito(habitoId: string, de?: Date, ate?: Date) {
    return prisma.registroHabito.findMany({
      where: {
        habitoId,
        ...(de || ate
          ? { data: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } }
          : {}),
      },
      orderBy: { data: "asc" },
    });
  },

  buscarRegistroPorId(id: string) {
    return prisma.registroHabito.findUnique({
      where: { id },
      include: { habito: { select: { usuarioId: true } } },
    });
  },

  criarRegistro(data: { habitoId: string; data: Date; valor: number }) {
    return prisma.registroHabito.create({ data });
  },

  atualizarRegistro(id: string, data: { data?: Date; valor?: number }) {
    return prisma.registroHabito.update({ where: { id }, data });
  },

  deletarRegistro(id: string) {
    return prisma.registroHabito.delete({ where: { id } });
  },
};
