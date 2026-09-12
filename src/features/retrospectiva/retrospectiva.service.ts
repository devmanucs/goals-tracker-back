import { calcularStreak } from "../habitos/habitos.calculos";
import { estudosRepository } from "../estudos/estudos.repository";
import { habitosRepository } from "../habitos/habitos.repository";
import { leituraRepository } from "../leitura/leitura.repository";
import { hojeISO, paraISO } from "../../shared/utils/datas";
import {
  habitosConcluidosPorMes,
  paginasLidasPorMes,
  paginasPorRegistro,
  topicoConcluido,
  topicosEstudadosPorMes,
} from "./retrospectiva.calculos";
import { RetrospectivaQuery } from "./retrospectiva.schema";

/**
 * Módulo agregador, como o dashboard: reusa os repositories dos outros módulos
 * em vez de escrever query Prisma própria. A diferença para o dashboard é que
 * aqui o recorte é por mês, o que nenhum service existente expõe — por isso a
 * leitura é feita no nível do repository e os cálculos ficam em
 * retrospectiva.calculos.ts.
 */
export const retrospectivaService = {
  async gerar(usuarioId: string, { meses }: RetrospectivaQuery, hoje = hojeISO()) {
    const [registrosLeitura, topicos, habitos] = await Promise.all([
      leituraRepository.listarRegistrosDoUsuario(usuarioId),
      estudosRepository.listarTopicosDoUsuario(usuarioId),
      habitosRepository.listarHabitos(usuarioId),
    ]);

    // Os registros de cada hábito, já no formato dos cálculos puros.
    const habitosComRegistros = await Promise.all(
      habitos.map(async (habito) => ({
        frequencia: habito.frequencia,
        metaValor: habito.metaValor,
        registros: (
          await habitosRepository.listarRegistrosDoHabito(habito.id)
        ).map((r) => ({ data: paraISO(r.data), valor: r.valor })),
      })),
    );

    const registrosSimples = registrosLeitura.map((r) => ({
      livroId: r.livroId,
      data: paraISO(r.data),
      paginaAtual: r.paginaAtual,
    }));

    const topicosSimples = topicos.map((t) => ({
      dataAgendada: paraISO(t.dataAgendada),
      status: t.status,
    }));

    const livros = await leituraRepository.listarLivros(usuarioId);

    return {
      meses,
      paginasLidasPorMes: paginasLidasPorMes(registrosSimples, meses, hoje),
      topicosEstudadosPorMes: topicosEstudadosPorMes(topicosSimples, meses, hoje),
      habitosConcluidosPorMes: habitosConcluidosPorMes(
        habitosComRegistros,
        meses,
        hoje,
      ),
      resumo: {
        livrosLidos: livros.filter((l) => l.status === "LIDO").length,
        // Total de todos os tempos, não só da janela — é um número de vitrine.
        paginasLidas: paginasPorRegistro(registrosSimples).reduce(
          (acc, p) => acc + p.paginas,
          0,
        ),
        topicosEstudados: topicosSimples.filter((t) => topicoConcluido(t.status))
          .length,
        maiorStreak: habitosComRegistros.reduce(
          (maior, habito) =>
            Math.max(
              maior,
              calcularStreak(
                habito.registros,
                habito.frequencia,
                habito.metaValor,
                hoje,
              ).recorde,
            ),
          0,
        ),
      },
    };
  },
};
