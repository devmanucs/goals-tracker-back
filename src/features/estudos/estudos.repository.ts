import { prisma } from "../../shared/lib/prisma";
import { StatusConcurso, StatusTopico } from "../../../generated/prisma/enums";

/**
 * Todo concurso devolvido pela API carrega o progresso dos seus tópicos. Buscar
 * o status deles junto evita o frontend fazer uma requisição por concurso só
 * para montar a barra de progresso do card.
 */
const COM_STATUS_DOS_TOPICOS = {
  topicos: { select: { status: true } },
} as const;

/** Só queries Prisma — a validação de posse fica no service. */
export const estudosRepository = {
  // --------------------------------------------------------------------------
  // Concursos
  // --------------------------------------------------------------------------

  listarConcursos(usuarioId: string) {
    return prisma.concurso.findMany({
      where: { usuarioId },
      orderBy: { dataProva: "asc" },
      include: COM_STATUS_DOS_TOPICOS,
    });
  },

  buscarConcursoPorId(id: string, usuarioId: string) {
    return prisma.concurso.findFirst({
      where: { id, usuarioId },
      include: COM_STATUS_DOS_TOPICOS,
    });
  },

  criarConcurso(data: {
    usuarioId: string;
    titulo: string;
    banca: string;
    dataProva: Date;
    status: StatusConcurso;
  }) {
    return prisma.concurso.create({ data });
  },

  atualizarConcurso(
    id: string,
    data: {
      titulo?: string;
      banca?: string;
      dataProva?: Date;
      status?: StatusConcurso;
    },
  ) {
    return prisma.concurso.update({ where: { id }, data });
  },

  deletarConcurso(id: string) {
    // Os tópicos caem junto por causa do onDelete: Cascade.
    return prisma.concurso.delete({ where: { id } });
  },

  // --------------------------------------------------------------------------
  // Tópicos
  // --------------------------------------------------------------------------

  listarTopicosDoConcurso(
    concursoId: string,
    opcoes: { ordenarPor: "peso" | "data"; status?: StatusTopico },
  ) {
    return prisma.topicoEstudo.findMany({
      where: opcoes.status ? { concursoId, status: opcoes.status } : { concursoId },
      orderBy:
        opcoes.ordenarPor === "peso"
          ? // Empate de peso é desempatado pela data, para a lista ficar estável.
            [{ peso: "desc" }, { dataAgendada: "asc" }]
          : [{ dataAgendada: "asc" }, { peso: "desc" }],
    });
  },

  /** Tópicos de todos os concursos do usuário — usado pelo próximo tópico e calendário global. */
  listarTopicosDoUsuario(
    usuarioId: string,
    filtros: { de?: Date; ate?: Date; status?: StatusTopico } = {},
  ) {
    return prisma.topicoEstudo.findMany({
      where: {
        concurso: { usuarioId },
        ...(filtros.status ? { status: filtros.status } : {}),
        ...(filtros.de || filtros.ate
          ? {
              dataAgendada: {
                ...(filtros.de ? { gte: filtros.de } : {}),
                ...(filtros.ate ? { lte: filtros.ate } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ dataAgendada: "asc" }, { peso: "desc" }],
      include: {
        concurso: { select: { id: true, titulo: true, dataProva: true } },
      },
    });
  },

  buscarTopicoPorId(id: string) {
    return prisma.topicoEstudo.findUnique({
      where: { id },
      include: { concurso: { select: { usuarioId: true } } },
    });
  },

  criarTopico(data: {
    concursoId: string;
    titulo: string;
    materia: string;
    peso: number;
    dataAgendada: Date;
    status: StatusTopico;
  }) {
    return prisma.topicoEstudo.create({ data });
  },

  atualizarTopico(
    id: string,
    data: {
      titulo?: string;
      materia?: string;
      peso?: number;
      dataAgendada?: Date;
      status?: StatusTopico;
    },
  ) {
    return prisma.topicoEstudo.update({ where: { id }, data });
  },

  deletarTopico(id: string) {
    return prisma.topicoEstudo.delete({ where: { id } });
  },
};
