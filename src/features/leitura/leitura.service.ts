import { AppError } from "../../shared/errors/AppErrors";
import { paraData, paraISO } from "../../shared/utils/datas";
import { leituraRepository } from "./leitura.repository";
import {
  AtualizarLivroInput,
  AtualizarRegistroInput,
  CriarLivroInput,
  CriarRegistroInput,
  EstatisticasQuery,
  ListarLivrosQuery,
  mapaStatusLivro,
} from "./leitura.schema";
import { Livro, RegistroLeitura } from "../../../generated/prisma/client";

// ----------------------------------------------------------------------------
// Serialização: o banco guarda DateTime + enum UPPER_SNAKE, a API devolve
// "YYYY-MM-DD" + enum lower_snake, que é o que o frontend consome.
// ----------------------------------------------------------------------------

export function serializarLivro(livro: Livro) {
  return {
    id: livro.id,
    titulo: livro.titulo,
    autor: livro.autor,
    totalPaginas: livro.totalPaginas,
    status: mapaStatusLivro.paraApi(livro.status),
    corCapa: livro.corCapa,
    createdAt: livro.createdAt.toISOString(),
  };
}

export function serializarRegistro(registro: RegistroLeitura) {
  return {
    id: registro.id,
    livroId: registro.livroId,
    data: paraISO(registro.data),
    paginaAtual: registro.paginaAtual,
    observacao: registro.observacao,
  };
}

// ----------------------------------------------------------------------------
// Cálculo de estatísticas (função pura, testável sem banco)
// ----------------------------------------------------------------------------

/** Forma mínima de registro que o cálculo precisa. */
export interface RegistroParaEstatistica {
  livroId: string;
  data: string;
  paginaAtual: number;
}

/**
 * Páginas lidas são calculadas por *delta*: cada registro conta só o avanço em
 * relação ao registro anterior do mesmo livro. Sem isso, "estou na página 200"
 * contaria 200 páginas toda vez que o usuário registrasse progresso.
 *
 * Porta a lógica de `estatisticasLeitura()` do frontend (features/leitura/data.ts).
 */
export function calcularPaginasLidas(registros: RegistroParaEstatistica[]) {
  const porLivro = new Map<string, RegistroParaEstatistica[]>();
  for (const registro of registros) {
    const lista = porLivro.get(registro.livroId) ?? [];
    lista.push(registro);
    porLivro.set(registro.livroId, lista);
  }

  let total = 0;
  for (const lista of porLivro.values()) {
    const ordenados = [...lista].sort((a, b) => a.data.localeCompare(b.data));
    let anterior = 0;
    for (const registro of ordenados) {
      total += Math.max(0, registro.paginaAtual - anterior);
      anterior = Math.max(anterior, registro.paginaAtual);
    }
  }
  return total;
}

/** Ritmo médio = páginas lidas dividido pelos dias em que houve registro. */
export function calcularRitmoMedio(registros: RegistroParaEstatistica[]) {
  const paginas = calcularPaginasLidas(registros);
  const diasComRegistro = new Set(registros.map((r) => r.data)).size;
  return Math.round((paginas / Math.max(diasComRegistro, 1)) * 10) / 10;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export const leituraService = {
  // --------------------------------------------------------------------------
  // Livros
  // --------------------------------------------------------------------------

  async listarLivros(usuarioId: string, filtros: ListarLivrosQuery) {
    const status = filtros.status ? mapaStatusLivro.paraDb(filtros.status) : undefined;
    const livros = await leituraRepository.listarLivros(usuarioId, status);
    return livros.map(serializarLivro);
  },

  /**
   * Busca um livro garantindo que ele pertence ao usuário. Devolve 404 (e não
   * 403) quando o livro é de outra pessoa: responder 403 confirmaria que aquele
   * id existe, o que vaza informação entre usuários.
   */
  async buscarLivro(id: string, usuarioId: string) {
    const livro = await leituraRepository.buscarLivroPorId(id, usuarioId);
    if (!livro) {
      throw new AppError("Livro não encontrado", 404);
    }
    return livro;
  },

  async obterLivro(id: string, usuarioId: string) {
    return serializarLivro(await this.buscarLivro(id, usuarioId));
  },

  async criarLivro(usuarioId: string, dados: CriarLivroInput) {
    const livro = await leituraRepository.criarLivro({
      usuarioId,
      titulo: dados.titulo,
      autor: dados.autor,
      totalPaginas: dados.totalPaginas,
      status: mapaStatusLivro.paraDb(dados.status),
      ...(dados.corCapa !== undefined ? { corCapa: dados.corCapa } : {}),
    });
    return serializarLivro(livro);
  },

  async atualizarLivro(id: string, usuarioId: string, dados: AtualizarLivroInput) {
    await this.buscarLivro(id, usuarioId);

    const livro = await leituraRepository.atualizarLivro(id, {
      ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
      ...(dados.autor !== undefined ? { autor: dados.autor } : {}),
      ...(dados.totalPaginas !== undefined ? { totalPaginas: dados.totalPaginas } : {}),
      ...(dados.status !== undefined
        ? { status: mapaStatusLivro.paraDb(dados.status) }
        : {}),
      ...(dados.corCapa !== undefined ? { corCapa: dados.corCapa } : {}),
    });
    return serializarLivro(livro);
  },

  async deletarLivro(id: string, usuarioId: string) {
    await this.buscarLivro(id, usuarioId);
    await leituraRepository.deletarLivro(id);
  },

  // --------------------------------------------------------------------------
  // Registros de leitura
  // --------------------------------------------------------------------------

  async listarRegistros(livroId: string, usuarioId: string) {
    // Valida a posse do livro antes de expor qualquer registro dele.
    await this.buscarLivro(livroId, usuarioId);
    const registros = await leituraRepository.listarRegistrosDoLivro(livroId);
    return registros.map(serializarRegistro);
  },

  async criarRegistro(livroId: string, usuarioId: string, dados: CriarRegistroInput) {
    const livro = await this.buscarLivro(livroId, usuarioId);

    if (dados.paginaAtual > livro.totalPaginas) {
      throw new AppError(
        `A página informada (${dados.paginaAtual}) é maior que o total de páginas do livro (${livro.totalPaginas})`,
        400,
      );
    }

    const registro = await leituraRepository.criarRegistro({
      livroId,
      data: paraData(dados.data),
      paginaAtual: dados.paginaAtual,
      ...(dados.observacao !== undefined ? { observacao: dados.observacao } : {}),
    });
    return serializarRegistro(registro);
  },

  /** Carrega o registro validando a posse através do livro pai. */
  async buscarRegistro(id: string, usuarioId: string) {
    const registro = await leituraRepository.buscarRegistroPorId(id);
    if (!registro || registro.livro.usuarioId !== usuarioId) {
      throw new AppError("Registro de leitura não encontrado", 404);
    }
    return registro;
  },

  async atualizarRegistro(
    id: string,
    usuarioId: string,
    dados: AtualizarRegistroInput,
  ) {
    await this.buscarRegistro(id, usuarioId);

    const registro = await leituraRepository.atualizarRegistro(id, {
      ...(dados.data !== undefined ? { data: paraData(dados.data) } : {}),
      ...(dados.paginaAtual !== undefined ? { paginaAtual: dados.paginaAtual } : {}),
      ...(dados.observacao !== undefined ? { observacao: dados.observacao } : {}),
    });
    return serializarRegistro(registro);
  },

  async deletarRegistro(id: string, usuarioId: string) {
    await this.buscarRegistro(id, usuarioId);
    await leituraRepository.deletarRegistro(id);
  },

  // --------------------------------------------------------------------------
  // Estatísticas
  // --------------------------------------------------------------------------

  /**
   * Livros lidos no período, páginas lidas e ritmo médio de páginas/dia.
   * Sem `de`/`ate` o período é a vida inteira da conta.
   */
  async estatisticas(usuarioId: string, periodo: EstatisticasQuery) {
    const de = periodo.de ? paraData(periodo.de) : undefined;
    const ate = periodo.ate ? paraData(periodo.ate) : undefined;

    const [livros, registros] = await Promise.all([
      leituraRepository.listarLivros(usuarioId),
      leituraRepository.listarRegistrosDoUsuario(usuarioId, de, ate),
    ]);

    const registrosSimples: RegistroParaEstatistica[] = registros.map((r) => ({
      livroId: r.livroId,
      data: paraISO(r.data),
      paginaAtual: r.paginaAtual,
    }));

    // Um livro conta como "lido no período" se está com status LIDO e teve
    // pelo menos um registro dentro da janela consultada.
    const livrosComRegistroNoPeriodo = new Set(registrosSimples.map((r) => r.livroId));
    const temFiltro = Boolean(de || ate);

    return {
      livrosLidos: livros.filter(
        (l) =>
          l.status === "LIDO" &&
          (!temFiltro || livrosComRegistroNoPeriodo.has(l.id)),
      ).length,
      livrosLendo: livros.filter((l) => l.status === "LENDO").length,
      livrosQueroLer: livros.filter((l) => l.status === "QUERO_LER").length,
      livrosAbandonados: livros.filter((l) => l.status === "ABANDONADO").length,
      paginasLidasTotal: calcularPaginasLidas(registrosSimples),
      ritmoMedioDiario: calcularRitmoMedio(registrosSimples),
      diasComRegistro: new Set(registrosSimples.map((r) => r.data)).size,
      periodo: temFiltro ? { de: periodo.de ?? null, ate: periodo.ate ?? null } : null,
    };
  },

  /** Livro que o usuário está lendo agora — usado pelo dashboard. */
  async livroEmAndamento(usuarioId: string) {
    const [livro] = await leituraRepository.listarLivros(usuarioId, "LENDO");
    if (!livro) return null;

    const registros = await leituraRepository.listarRegistrosDoLivro(livro.id);
    const ultimo = registros.at(-1);
    const paginaAtual = ultimo?.paginaAtual ?? 0;

    return {
      ...serializarLivro(livro),
      paginaAtual,
      percentual:
        livro.totalPaginas > 0
          ? Math.min(100, Math.round((paginaAtual / livro.totalPaginas) * 100))
          : 0,
      ultimaLeitura: ultimo ? paraISO(ultimo.data) : null,
    };
  },
};
