import { AppError } from "../../shared/errors/AppErrors";
import { hojeISO, paraData, paraISO } from "../../shared/utils/datas";
import {
  calcularStreak,
  progressoPeriodoAtual,
  RegistroParaCalculo,
} from "./habitos.calculos";
import { habitosRepository } from "./habitos.repository";
import {
  AtualizarHabitoInput,
  AtualizarRegistroHabitoInput,
  CriarHabitoInput,
  CriarRegistroHabitoInput,
  ListarRegistrosQuery,
  mapaFrequencia,
} from "./habitos.schema";
import { Habito, RegistroHabito } from "../../../generated/prisma/client";

// ----------------------------------------------------------------------------
// Serialização
// ----------------------------------------------------------------------------

export function serializarHabito(habito: Habito) {
  return {
    id: habito.id,
    nome: habito.nome,
    unidade: habito.unidade,
    frequencia: mapaFrequencia.paraApi(habito.frequencia),
    metaValor: habito.metaValor,
    icone: habito.icone,
    createdAt: habito.createdAt.toISOString(),
  };
}

export function serializarRegistroHabito(registro: RegistroHabito) {
  return {
    id: registro.id,
    habitoId: registro.habitoId,
    data: paraISO(registro.data),
    valor: registro.valor,
  };
}

/** Converte registros do banco para a forma que os cálculos puros esperam. */
function paraCalculo(registros: RegistroHabito[]): RegistroParaCalculo[] {
  return registros.map((r) => ({ data: paraISO(r.data), valor: r.valor }));
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export const habitosService = {
  // --------------------------------------------------------------------------
  // Hábitos
  // --------------------------------------------------------------------------

  async listarHabitos(usuarioId: string) {
    const habitos = await habitosRepository.listarHabitos(usuarioId);
    return habitos.map(serializarHabito);
  },

  /** 404 (e não 403) quando o hábito é de outro usuário: não confirma o id. */
  async buscarHabito(id: string, usuarioId: string) {
    const habito = await habitosRepository.buscarHabitoPorId(id, usuarioId);
    if (!habito) {
      throw new AppError("Hábito não encontrado", 404);
    }
    return habito;
  },

  async obterHabito(id: string, usuarioId: string) {
    return serializarHabito(await this.buscarHabito(id, usuarioId));
  },

  async criarHabito(usuarioId: string, dados: CriarHabitoInput) {
    const habito = await habitosRepository.criarHabito({
      usuarioId,
      nome: dados.nome,
      unidade: dados.unidade,
      frequencia: mapaFrequencia.paraDb(dados.frequencia),
      metaValor: dados.metaValor,
      ...(dados.icone !== undefined ? { icone: dados.icone } : {}),
    });
    return serializarHabito(habito);
  },

  async atualizarHabito(id: string, usuarioId: string, dados: AtualizarHabitoInput) {
    await this.buscarHabito(id, usuarioId);

    const habito = await habitosRepository.atualizarHabito(id, {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.unidade !== undefined ? { unidade: dados.unidade } : {}),
      ...(dados.frequencia !== undefined
        ? { frequencia: mapaFrequencia.paraDb(dados.frequencia) }
        : {}),
      ...(dados.metaValor !== undefined ? { metaValor: dados.metaValor } : {}),
      ...(dados.icone !== undefined ? { icone: dados.icone } : {}),
    });
    return serializarHabito(habito);
  },

  async deletarHabito(id: string, usuarioId: string) {
    await this.buscarHabito(id, usuarioId);
    await habitosRepository.deletarHabito(id);
  },

  // --------------------------------------------------------------------------
  // Registros
  // --------------------------------------------------------------------------

  async listarRegistros(
    habitoId: string,
    usuarioId: string,
    janela: ListarRegistrosQuery,
  ) {
    await this.buscarHabito(habitoId, usuarioId);

    const registros = await habitosRepository.listarRegistrosDoHabito(
      habitoId,
      janela.de ? paraData(janela.de) : undefined,
      janela.ate ? paraData(janela.ate) : undefined,
    );
    return registros.map(serializarRegistroHabito);
  },

  /**
   * Vários registros no mesmo dia são permitidos e somam entre si — o usuário
   * lança incrementos ("agora bebi mais 0.5 L"), não o total do dia.
   */
  async criarRegistro(
    habitoId: string,
    usuarioId: string,
    dados: CriarRegistroHabitoInput,
  ) {
    await this.buscarHabito(habitoId, usuarioId);

    const registro = await habitosRepository.criarRegistro({
      habitoId,
      data: paraData(dados.data),
      valor: dados.valor,
    });
    return serializarRegistroHabito(registro);
  },

  /** Carrega o registro validando a posse através do hábito pai. */
  async buscarRegistro(id: string, usuarioId: string) {
    const registro = await habitosRepository.buscarRegistroPorId(id);
    if (!registro || registro.habito.usuarioId !== usuarioId) {
      throw new AppError("Registro não encontrado", 404);
    }
    return registro;
  },

  async atualizarRegistro(
    id: string,
    usuarioId: string,
    dados: AtualizarRegistroHabitoInput,
  ) {
    await this.buscarRegistro(id, usuarioId);

    const registro = await habitosRepository.atualizarRegistro(id, {
      ...(dados.data !== undefined ? { data: paraData(dados.data) } : {}),
      ...(dados.valor !== undefined ? { valor: dados.valor } : {}),
    });
    return serializarRegistroHabito(registro);
  },

  async deletarRegistro(id: string, usuarioId: string) {
    await this.buscarRegistro(id, usuarioId);
    await habitosRepository.deletarRegistro(id);
  },

  // --------------------------------------------------------------------------
  // Derivados: progresso e streak
  // --------------------------------------------------------------------------

  async progressoAtual(habitoId: string, usuarioId: string, hoje = hojeISO()) {
    const habito = await this.buscarHabito(habitoId, usuarioId);
    const registros = await habitosRepository.listarRegistrosDoHabito(habitoId);

    return {
      habitoId,
      unidade: habito.unidade,
      frequencia: mapaFrequencia.paraApi(habito.frequencia),
      ...progressoPeriodoAtual(
        paraCalculo(registros),
        habito.frequencia,
        habito.metaValor,
        hoje,
      ),
    };
  },

  async streak(habitoId: string, usuarioId: string, hoje = hojeISO()) {
    const habito = await this.buscarHabito(habitoId, usuarioId);
    const registros = await habitosRepository.listarRegistrosDoHabito(habitoId);

    return {
      habitoId,
      frequencia: mapaFrequencia.paraApi(habito.frequencia),
      ...calcularStreak(
        paraCalculo(registros),
        habito.frequencia,
        habito.metaValor,
        hoje,
      ),
    };
  },

  /**
   * Resumo de todos os hábitos do usuário com streak e progresso já calculados.
   * É o que o dashboard consome — evita o frontend fazer N+1 requisições.
   */
  async resumo(usuarioId: string, hoje = hojeISO()) {
    const habitos = await habitosRepository.listarHabitos(usuarioId);

    return Promise.all(
      habitos.map(async (habito) => {
        const registros = paraCalculo(
          await habitosRepository.listarRegistrosDoHabito(habito.id),
        );

        return {
          ...serializarHabito(habito),
          progresso: progressoPeriodoAtual(
            registros,
            habito.frequencia,
            habito.metaValor,
            hoje,
          ),
          streak: calcularStreak(registros, habito.frequencia, habito.metaValor, hoje),
        };
      }),
    );
  },
};
