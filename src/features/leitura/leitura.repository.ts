import { prisma } from "../../shared/lib/prisma";
import { StatusLivro } from "../../../generated/prisma/enums";

/**
 * Todo livro devolvido pela API carrega a página atual, que é a do registro de
 * leitura mais recente. Buscar isso junto evita o frontend fazer uma requisição
 * por livro só para montar a barra de progresso do card.
 */
const COM_ULTIMO_REGISTRO = {
  registros: {
    orderBy: { data: "desc" },
    take: 1,
    select: { paginaAtual: true, data: true },
  },
} as const;

/**
 * Só queries Prisma — nenhuma regra de negócio aqui.
 * Todas as buscas de livro recebem `usuarioId` e filtram por ele: é assim que o
 * isolamento multiusuário é garantido na camada mais baixa.
 */
export const leituraRepository = {
  // --------------------------------------------------------------------------
  // Livros
  // --------------------------------------------------------------------------

  listarLivros(usuarioId: string, status?: StatusLivro) {
    return prisma.livro.findMany({
      where: status ? { usuarioId, status } : { usuarioId },
      orderBy: { createdAt: "desc" },
      include: COM_ULTIMO_REGISTRO,
    });
  },

  buscarLivroPorId(id: string, usuarioId: string) {
    return prisma.livro.findFirst({
      where: { id, usuarioId },
      include: COM_ULTIMO_REGISTRO,
    });
  },

  criarLivro(data: {
    usuarioId: string;
    titulo: string;
    autor: string;
    totalPaginas: number;
    status: StatusLivro;
    corCapa?: string;
    capaUrl?: string;
    sinopse?: string;
    isbn?: string;
    anoPublicacao?: number;
  }) {
    return prisma.livro.create({ data });
  },

  atualizarLivro(
    id: string,
    data: {
      titulo?: string;
      autor?: string;
      totalPaginas?: number;
      status?: StatusLivro;
      corCapa?: string;
      capaUrl?: string;
      sinopse?: string;
      isbn?: string;
      anoPublicacao?: number;
    },
  ) {
    return prisma.livro.update({ where: { id }, data });
  },

  deletarLivro(id: string) {
    // Os registros de leitura caem junto por causa do onDelete: Cascade.
    return prisma.livro.delete({ where: { id } });
  },

  // --------------------------------------------------------------------------
  // Registros de leitura
  // --------------------------------------------------------------------------

  listarRegistrosDoLivro(livroId: string) {
    return prisma.registroLeitura.findMany({
      where: { livroId },
      orderBy: { data: "asc" },
    });
  },

  /** Todos os registros do usuário, usados pelo cálculo de estatísticas. */
  listarRegistrosDoUsuario(usuarioId: string, de?: Date, ate?: Date) {
    return prisma.registroLeitura.findMany({
      where: {
        livro: { usuarioId },
        ...(de || ate
          ? { data: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } }
          : {}),
      },
      orderBy: { data: "asc" },
    });
  },

  buscarRegistroPorId(id: string) {
    return prisma.registroLeitura.findUnique({
      where: { id },
      include: { livro: { select: { usuarioId: true } } },
    });
  },

  criarRegistro(data: {
    livroId: string;
    data: Date;
    paginaAtual: number;
    observacao?: string;
  }) {
    return prisma.registroLeitura.create({ data });
  },

  atualizarRegistro(
    id: string,
    data: { data?: Date; paginaAtual?: number; observacao?: string },
  ) {
    return prisma.registroLeitura.update({ where: { id }, data });
  },

  deletarRegistro(id: string) {
    return prisma.registroLeitura.delete({ where: { id } });
  },
};
