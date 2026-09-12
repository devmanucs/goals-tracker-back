import { estudosService } from "../estudos/estudos.service";
import { habitosService } from "../habitos/habitos.service";
import { leituraService } from "../leitura/leitura.service";

/**
 * O dashboard é puramente agregador: ele compõe o que os outros módulos já
 * sabem calcular. Não existe repository nem query Prisma aqui de propósito —
 * duplicar as queries faria a regra de streak/progresso divergir com o tempo.
 */
export const dashboardService = {
  async resumo(usuarioId: string) {
    // As três chamadas são independentes, então vão em paralelo.
    const [livroAtual, proximoTopico, habitos, concursos, estatisticasLeitura] =
      await Promise.all([
        leituraService.livroEmAndamento(usuarioId),
        estudosService.proximoTopico(usuarioId),
        habitosService.resumo(usuarioId),
        estudosService.listarConcursos(usuarioId),
        leituraService.estatisticas(usuarioId, {}),
      ]);

    // A lista vem inteira, ordenada pelo streak: o card do dashboard mostra
    // todos os hábitos com sua barra, e "streaks ativos" é só uma contagem.
    const lista = [...habitos].sort((a, b) => b.streak.atual - a.streak.atual);

    return {
      leitura: {
        livroAtual,
        livrosLidos: estatisticasLeitura.livrosLidos,
        paginasLidasTotal: estatisticasLeitura.paginasLidasTotal,
        ritmoMedioDiario: estatisticasLeitura.ritmoMedioDiario,
      },
      estudos: {
        proximoTopico,
        concursosAtivos: concursos.filter((c) => c.status !== "encerrado").length,
      },
      habitos: {
        total: habitos.length,
        lista,
        // "Ativo" = o hábito vem de pelo menos um período consecutivo batido.
        comStreakAtivo: habitos.filter((h) => h.streak.atual > 0).length,
        // Quantos hábitos já bateram a meta do período vigente.
        metasBatidasNoPeriodo: habitos.filter((h) => h.progresso.batido).length,
      },
    };
  },
};
