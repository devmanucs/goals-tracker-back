import { FrequenciaHabito } from "../../../generated/prisma/enums";
import { paraData, paraISO, somarDias } from "../../shared/utils/datas";

/**
 * Toda a matemática de hábitos vive aqui como funções puras (sem Prisma, sem
 * Express): é a parte mais delicada do módulo e a que mais precisa de teste.
 *
 * A ideia central é o "período": a janela contra a qual a meta é medida.
 * Um período é identificado pela sua data de início em formato ISO, o que deixa
 * as três frequências (diária, semanal, mensal) com o mesmo tipo de chave.
 */

export interface RegistroParaCalculo {
  data: string;
  valor: number;
}

/** Data de início do período que contém `iso`. */
export function inicioDoPeriodo(iso: string, frequencia: FrequenciaHabito): string {
  if (frequencia === "DIARIA") return iso;

  if (frequencia === "SEMANAL") {
    // Semana começa na segunda-feira, como no calendário do frontend.
    const data = paraData(iso);
    const diaDaSemana = data.getUTCDay(); // 0 = domingo
    const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
    return somarDias(iso, -recuo);
  }

  return `${iso.slice(0, 7)}-01`;
}

/** Última data (inclusiva) do período iniciado em `inicio`. */
export function fimDoPeriodo(inicio: string, frequencia: FrequenciaHabito): string {
  if (frequencia === "DIARIA") return inicio;
  if (frequencia === "SEMANAL") return somarDias(inicio, 6);

  // Primeiro dia do mês seguinte, menos um dia.
  const data = paraData(inicio);
  data.setUTCMonth(data.getUTCMonth() + 1);
  return somarDias(paraISO(data), -1);
}

/** Início do período imediatamente anterior a `inicio`. */
export function periodoAnterior(inicio: string, frequencia: FrequenciaHabito): string {
  if (frequencia === "DIARIA") return somarDias(inicio, -1);
  if (frequencia === "SEMANAL") return somarDias(inicio, -7);

  const data = paraData(inicio);
  data.setUTCMonth(data.getUTCMonth() - 1);
  return `${paraISO(data).slice(0, 7)}-01`;
}

/** Soma dos valores registrados, agrupada pelo início do período de cada registro. */
export function somarPorPeriodo(
  registros: RegistroParaCalculo[],
  frequencia: FrequenciaHabito,
): Map<string, number> {
  const totais = new Map<string, number>();
  for (const registro of registros) {
    const chave = inicioDoPeriodo(registro.data, frequencia);
    totais.set(chave, (totais.get(chave) ?? 0) + registro.valor);
  }
  return totais;
}

/** Arredonda para uma casa decimal — evita 1.7999999999 em somas de floats. */
function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export interface ProgressoPeriodo {
  inicio: string;
  fim: string;
  atual: number;
  meta: number;
  percentual: number;
  batido: boolean;
}

/** Progresso acumulado do período vigente (o que contém `hoje`). */
export function progressoPeriodoAtual(
  registros: RegistroParaCalculo[],
  frequencia: FrequenciaHabito,
  metaValor: number,
  hoje: string,
): ProgressoPeriodo {
  const inicio = inicioDoPeriodo(hoje, frequencia);
  const fim = fimDoPeriodo(inicio, frequencia);

  const atual = registros
    .filter((r) => r.data >= inicio && r.data <= fim)
    .reduce((acc, r) => acc + r.valor, 0);

  return {
    inicio,
    fim,
    atual: arredondar(atual),
    meta: metaValor,
    percentual: metaValor > 0 ? Math.min(100, Math.round((atual / metaValor) * 100)) : 0,
    batido: atual >= metaValor,
  };
}

export interface Streak {
  /** Quantidade de períodos consecutivos em que a meta foi batida. */
  atual: number;
  /** Se o período vigente já bateu a meta (ele não quebra o streak enquanto corre). */
  periodoAtualBatido: boolean;
  /** Maior sequência já alcançada no histórico. */
  recorde: number;
}

/**
 * Streak = períodos CONSECUTIVOS em que a soma dos valores bateu a meta,
 * contando de trás para frente a partir de hoje.
 *
 * Regra importante: o período vigente ainda está em andamento, então ele só
 * *soma* ao streak quando já bateu a meta — nunca o zera. Sem isso, o streak de
 * um hábito diário apareceria como 0 toda manhã antes do primeiro registro.
 */
export function calcularStreak(
  registros: RegistroParaCalculo[],
  frequencia: FrequenciaHabito,
  metaValor: number,
  hoje: string,
  // Teto de segurança: impede laço infinito em dados inesperados.
  maximoDePeriodos = 730,
): Streak {
  const totais = somarPorPeriodo(registros, frequencia);
  const periodoAtual = inicioDoPeriodo(hoje, frequencia);
  const periodoAtualBatido = (totais.get(periodoAtual) ?? 0) >= metaValor;

  let atual = periodoAtualBatido ? 1 : 0;
  let cursor = periodoAnterior(periodoAtual, frequencia);

  for (let i = 0; i < maximoDePeriodos; i++) {
    if ((totais.get(cursor) ?? 0) < metaValor) break;
    atual++;
    cursor = periodoAnterior(cursor, frequencia);
  }

  return { atual, periodoAtualBatido, recorde: calcularRecorde(totais, frequencia, metaValor) };
}

/**
 * Maior sequência de períodos consecutivos batidos em todo o histórico.
 * Percorre as chaves em ordem e reinicia a contagem sempre que há um buraco
 * (período sem registro) ou um período abaixo da meta.
 */
function calcularRecorde(
  totais: Map<string, number>,
  frequencia: FrequenciaHabito,
  metaValor: number,
): number {
  const batidos = [...totais.entries()]
    .filter(([, total]) => total >= metaValor)
    .map(([chave]) => chave)
    .sort();

  let recorde = 0;
  let sequencia = 0;
  let anterior: string | null = null;

  for (const chave of batidos) {
    const contiguo = anterior !== null && periodoAnterior(chave, frequencia) === anterior;
    sequencia = contiguo ? sequencia + 1 : 1;
    recorde = Math.max(recorde, sequencia);
    anterior = chave;
  }

  return recorde;
}
