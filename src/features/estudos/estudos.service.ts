import { AppError } from "../../shared/errors/AppErrors";
import { diasEntre, hojeISO, paraData, paraISO } from "../../shared/utils/datas";
import { estudosRepository } from "./estudos.repository";
import {
  AtualizarConcursoInput,
  AtualizarTopicoInput,
  CalendarioQuery,
  CriarConcursoInput,
  CriarTopicoInput,
  ListarTopicosQuery,
  mapaStatusConcurso,
  mapaStatusTopico,
} from "./estudos.schema";
import { Concurso, TopicoEstudo } from "../../../generated/prisma/client";

// ----------------------------------------------------------------------------
// Serialização
// ----------------------------------------------------------------------------

export function serializarConcurso(concurso: Concurso) {
  return {
    id: concurso.id,
    titulo: concurso.titulo,
    banca: concurso.banca,
    dataProva: paraISO(concurso.dataProva),
    status: mapaStatusConcurso.paraApi(concurso.status),
    createdAt: concurso.createdAt.toISOString(),
  };
}

export function serializarTopico(topico: TopicoEstudo) {
  return {
    id: topico.id,
    concursoId: topico.concursoId,
    titulo: topico.titulo,
    materia: topico.materia,
    peso: topico.peso,
    dataAgendada: paraISO(topico.dataAgendada),
    status: mapaStatusTopico.paraApi(topico.status),
  };
}

// ----------------------------------------------------------------------------
// Cálculos puros (testáveis sem banco)
// ----------------------------------------------------------------------------

/** Um tópico conta como concluído quando está "estudado" ou em "revisao". */
export function topicoConcluido(status: string) {
  return status === "ESTUDADO" || status === "REVISAO";
}

/** Percentual de tópicos concluídos do concurso (0-100). */
export function calcularProgresso(topicos: { status: string }[]) {
  if (topicos.length === 0) return 0;
  const concluidos = topicos.filter((t) => topicoConcluido(t.status)).length;
  return Math.round((concluidos / topicos.length) * 100);
}

/**
 * Agrupa tópicos por `dataAgendada` para a visão de calendário.
 * Devolve uma lista ordenada por data (e não um objeto) para o frontend poder
 * iterar direto sem depender da ordem de chaves de um objeto JSON.
 */
export function agruparPorData<T extends { dataAgendada: string }>(topicos: T[]) {
  const porData = new Map<string, T[]>();
  for (const topico of topicos) {
    const lista = porData.get(topico.dataAgendada) ?? [];
    lista.push(topico);
    porData.set(topico.dataAgendada, lista);
  }

  return [...porData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, itens]) => ({ data, total: itens.length, topicos: itens }));
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export const estudosService = {
  // --------------------------------------------------------------------------
  // Concursos
  // --------------------------------------------------------------------------

  async listarConcursos(usuarioId: string) {
    const concursos = await estudosRepository.listarConcursos(usuarioId);
    return concursos.map(serializarConcurso);
  },

  /** 404 (e não 403) quando o concurso é de outro usuário: não confirma o id. */
  async buscarConcurso(id: string, usuarioId: string) {
    const concurso = await estudosRepository.buscarConcursoPorId(id, usuarioId);
    if (!concurso) {
      throw new AppError("Concurso não encontrado", 404);
    }
    return concurso;
  },

  async obterConcurso(id: string, usuarioId: string) {
    return serializarConcurso(await this.buscarConcurso(id, usuarioId));
  },

  async criarConcurso(usuarioId: string, dados: CriarConcursoInput) {
    const concurso = await estudosRepository.criarConcurso({
      usuarioId,
      titulo: dados.titulo,
      banca: dados.banca,
      dataProva: paraData(dados.dataProva),
      status: mapaStatusConcurso.paraDb(dados.status),
    });
    return serializarConcurso(concurso);
  },

  async atualizarConcurso(
    id: string,
    usuarioId: string,
    dados: AtualizarConcursoInput,
  ) {
    await this.buscarConcurso(id, usuarioId);

    const concurso = await estudosRepository.atualizarConcurso(id, {
      ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
      ...(dados.banca !== undefined ? { banca: dados.banca } : {}),
      ...(dados.dataProva !== undefined
        ? { dataProva: paraData(dados.dataProva) }
        : {}),
      ...(dados.status !== undefined
        ? { status: mapaStatusConcurso.paraDb(dados.status) }
        : {}),
    });
    return serializarConcurso(concurso);
  },

  async deletarConcurso(id: string, usuarioId: string) {
    await this.buscarConcurso(id, usuarioId);
    await estudosRepository.deletarConcurso(id);
  },

  // --------------------------------------------------------------------------
  // Tópicos
  // --------------------------------------------------------------------------

  /** Lista tópicos do concurso; `ordenarPor=peso` traz os mais pesados primeiro. */
  async listarTopicos(
    concursoId: string,
    usuarioId: string,
    filtros: ListarTopicosQuery,
  ) {
    await this.buscarConcurso(concursoId, usuarioId);

    const topicos = await estudosRepository.listarTopicosDoConcurso(concursoId, {
      ordenarPor: filtros.ordenarPor,
      ...(filtros.status ? { status: mapaStatusTopico.paraDb(filtros.status) } : {}),
    });
    return topicos.map(serializarTopico);
  },

  async criarTopico(concursoId: string, usuarioId: string, dados: CriarTopicoInput) {
    await this.buscarConcurso(concursoId, usuarioId);

    const topico = await estudosRepository.criarTopico({
      concursoId,
      titulo: dados.titulo,
      materia: dados.materia,
      peso: dados.peso,
      dataAgendada: paraData(dados.dataAgendada),
      status: mapaStatusTopico.paraDb(dados.status),
    });
    return serializarTopico(topico);
  },

  /** Carrega o tópico validando a posse através do concurso pai. */
  async buscarTopico(id: string, usuarioId: string) {
    const topico = await estudosRepository.buscarTopicoPorId(id);
    if (!topico || topico.concurso.usuarioId !== usuarioId) {
      throw new AppError("Tópico não encontrado", 404);
    }
    return topico;
  },

  async obterTopico(id: string, usuarioId: string) {
    return serializarTopico(await this.buscarTopico(id, usuarioId));
  },

  async atualizarTopico(id: string, usuarioId: string, dados: AtualizarTopicoInput) {
    await this.buscarTopico(id, usuarioId);

    const topico = await estudosRepository.atualizarTopico(id, {
      ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
      ...(dados.materia !== undefined ? { materia: dados.materia } : {}),
      ...(dados.peso !== undefined ? { peso: dados.peso } : {}),
      ...(dados.dataAgendada !== undefined
        ? { dataAgendada: paraData(dados.dataAgendada) }
        : {}),
      ...(dados.status !== undefined
        ? { status: mapaStatusTopico.paraDb(dados.status) }
        : {}),
    });
    return serializarTopico(topico);
  },

  async deletarTopico(id: string, usuarioId: string) {
    await this.buscarTopico(id, usuarioId);
    await estudosRepository.deletarTopico(id);
  },

  // --------------------------------------------------------------------------
  // Derivados
  // --------------------------------------------------------------------------

  /** Visão calendário: tópicos do concurso agrupados por dataAgendada. */
  async calendarioDoConcurso(
    concursoId: string,
    usuarioId: string,
    janela: CalendarioQuery,
  ) {
    await this.buscarConcurso(concursoId, usuarioId);

    const topicos = await estudosRepository.listarTopicosDoConcurso(concursoId, {
      ordenarPor: "data",
    });

    const serializados = topicos.map(serializarTopico).filter((topico) => {
      if (janela.de && topico.dataAgendada < janela.de) return false;
      if (janela.ate && topico.dataAgendada > janela.ate) return false;
      return true;
    });

    return agruparPorData(serializados);
  },

  /** Mesma visão calendário, mas atravessando todos os concursos do usuário. */
  async calendarioGeral(usuarioId: string, janela: CalendarioQuery) {
    const topicos = await estudosRepository.listarTopicosDoUsuario(usuarioId, {
      ...(janela.de ? { de: paraData(janela.de) } : {}),
      ...(janela.ate ? { ate: paraData(janela.ate) } : {}),
    });

    return agruparPorData(
      topicos.map((topico) => ({
        ...serializarTopico(topico),
        concurso: topico.concurso,
      })),
    );
  },

  async progressoDoConcurso(concursoId: string, usuarioId: string) {
    await this.buscarConcurso(concursoId, usuarioId);

    const topicos = await estudosRepository.listarTopicosDoConcurso(concursoId, {
      ordenarPor: "data",
    });

    return {
      total: topicos.length,
      concluidos: topicos.filter((t) => topicoConcluido(t.status)).length,
      percentual: calcularProgresso(topicos),
    };
  },

  async diasAteProva(concursoId: string, usuarioId: string) {
    const concurso = await this.buscarConcurso(concursoId, usuarioId);
    const dataProva = paraISO(concurso.dataProva);

    return { dataProva, dias: diasEntre(hojeISO(), dataProva) };
  },

  /**
   * Próximo tópico agendado que ainda não foi estudado, de hoje em diante.
   * Porta `proximoTopico()` do frontend (features/estudos/data.ts) — usado no
   * dashboard.
   */
  async proximoTopico(usuarioId: string) {
    const hoje = hojeISO();

    const topicos = await estudosRepository.listarTopicosDoUsuario(usuarioId, {
      de: paraData(hoje),
    });

    const proximo = topicos.find((t) => !topicoConcluido(t.status));
    if (!proximo) return null;

    return {
      ...serializarTopico(proximo),
      concurso: proximo.concurso,
      emQuantosDias: diasEntre(hoje, paraISO(proximo.dataAgendada)),
    };
  },
};
