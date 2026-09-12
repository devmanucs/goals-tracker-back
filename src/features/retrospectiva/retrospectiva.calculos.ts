/**
 * Cálculos da retrospectiva como funções puras (sem Prisma, sem Express).
 *
 * Porta `src/features/retrospectiva/data.ts` do frontend. As séries aqui
 * alimentam os gráficos do `retrospectiva-charts.tsx`, então o formato de cada
 * ponto ({ mes, paginas } / { mes, topicos } / { mes, percentual }) é contrato
 * com o recharts e não deve mudar sem mexer lá também.
 */

const MESES_LABEL = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Chave do mês de uma data ISO: "2026-08-13" -> "2026-08". */
export function chaveDoMes(iso: string): string {
  return iso.slice(0, 7);
}

/** Rótulo curto do mês, como o eixo X dos gráficos espera: "2026-08" -> "ago". */
export function labelDoMes(chave: string): string {
  const mes = Number(chave.slice(5, 7));
  return MESES_LABEL[mes - 1] ?? chave;
}

/**
 * As N chaves de mês terminando no mês de `hoje`, em ordem cronológica.
 * Inclui meses sem nenhum dado — o gráfico precisa da barra zerada para a
 * linha do tempo não ficar com buraco.
 */
export function ultimosMeses(quantidade: number, hoje: string): string[] {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));

  const chaves: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    // Date em UTC resolve sozinho a virada de ano ao subtrair meses.
    const data = new Date(Date.UTC(ano, mes - 1 - i, 1));
    chaves.push(
      `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return chaves;
}

// ----------------------------------------------------------------------------
// Leitura
// ----------------------------------------------------------------------------

export interface RegistroLeituraSimples {
  livroId: string;
  data: string;
  paginaAtual: number;
}

/**
 * Páginas lidas em cada registro, contadas por *delta* contra o registro
 * anterior do mesmo livro — mesma regra de `/leitura/estatisticas`. Sem isso,
 * "estou na página 200" contaria 200 páginas toda vez.
 */
export function paginasPorRegistro(registros: RegistroLeituraSimples[]) {
  const porLivro = new Map<string, RegistroLeituraSimples[]>();
  for (const registro of registros) {
    const lista = porLivro.get(registro.livroId) ?? [];
    lista.push(registro);
    porLivro.set(registro.livroId, lista);
  }

  const resultado: { mes: string; paginas: number }[] = [];
  for (const lista of porLivro.values()) {
    const ordenados = [...lista].sort((a, b) => a.data.localeCompare(b.data));
    let anterior = 0;
    for (const registro of ordenados) {
      resultado.push({
        mes: chaveDoMes(registro.data),
        paginas: Math.max(0, registro.paginaAtual - anterior),
      });
      anterior = Math.max(anterior, registro.paginaAtual);
    }
  }
  return resultado;
}

export function paginasLidasPorMes(
  registros: RegistroLeituraSimples[],
  quantidade: number,
  hoje: string,
) {
  const porRegistro = paginasPorRegistro(registros);

  return ultimosMeses(quantidade, hoje).map((chave) => ({
    mes: labelDoMes(chave),
    paginas: porRegistro
      .filter((p) => p.mes === chave)
      .reduce((acc, p) => acc + p.paginas, 0),
  }));
}

// ----------------------------------------------------------------------------
// Estudos
// ----------------------------------------------------------------------------

export interface TopicoSimples {
  dataAgendada: string;
  status: string;
}

/** Um tópico conta como concluído quando está "estudado" ou em "revisao". */
export function topicoConcluido(status: string): boolean {
  return status === "ESTUDADO" || status === "REVISAO";
}

export function topicosEstudadosPorMes(
  topicos: TopicoSimples[],
  quantidade: number,
  hoje: string,
) {
  const concluidos = topicos.filter((t) => topicoConcluido(t.status));

  return ultimosMeses(quantidade, hoje).map((chave) => ({
    mes: labelDoMes(chave),
    topicos: concluidos.filter((t) => chaveDoMes(t.dataAgendada) === chave).length,
  }));
}

// ----------------------------------------------------------------------------
// Hábitos
// ----------------------------------------------------------------------------

export interface HabitoSimples {
  frequencia: string;
  metaValor: number;
  registros: { data: string; valor: number }[];
}

/**
 * Percentual dos hábitos *ativos no mês* que bateram a meta.
 *
 * "Ativo" = teve ao menos um registro naquele mês; hábito criado depois não
 * derruba os meses anteriores. Para hábito diário a meta do mês é escalada
 * pelos dias registrados (meta × dias com registro); para semanal/mensal a
 * meta do período vale para o mês inteiro. É a mesma regra do mock do
 * frontend, mantida para o gráfico não mudar de leitura ao trocar de fonte.
 */
export function habitosConcluidosPorMes(
  habitos: HabitoSimples[],
  quantidade: number,
  hoje: string,
) {
  return ultimosMeses(quantidade, hoje).map((chave) => {
    let cumpridos = 0;
    let total = 0;

    for (const habito of habitos) {
      const registrosDoMes = habito.registros.filter(
        (r) => chaveDoMes(r.data) === chave,
      );
      if (registrosDoMes.length === 0) continue;

      total += 1;
      const soma = registrosDoMes.reduce((acc, r) => acc + r.valor, 0);
      const multiplicador =
        habito.frequencia === "DIARIA" ? registrosDoMes.length : 1;

      if (soma >= habito.metaValor * Math.max(multiplicador, 1)) cumpridos += 1;
    }

    return {
      mes: labelDoMes(chave),
      percentual: total ? Math.round((cumpridos / total) * 100) : 0,
    };
  });
}
