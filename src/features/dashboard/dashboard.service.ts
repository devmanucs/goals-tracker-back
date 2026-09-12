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

    // "Ativo" = o hábito vem de pelo menos um período consecutivo batido.
    const streaksAtivos = habitos
      .filter((habito) => habito.streak.atual > 0)
      .map((habito) => ({
        habitoId: habito.id,
        nome: habito.nome,
        unidade: habito.unidade,
        frequencia: habito.frequencia,
        icone: habito.icone,
        streak: habito.streak.atual,
        recorde: habito.streak.recorde,
        progresso: habito.progresso,
      }))
      .sort((a, b) => b.streak - a.streak);

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
        streaksAtivos,
        // Quantos hábitos já bateram a meta do período vigente.
        metasBatidasNoPeriodo: habitos.filter((h) => h.progresso.batido).length,
      },
    };
  },
};
