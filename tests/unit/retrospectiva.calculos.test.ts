import { describe, expect, it } from "vitest";
import {
  chaveDoMes,
  habitosConcluidosPorMes,
  labelDoMes,
  paginasLidasPorMes,
  paginasPorRegistro,
  topicosEstudadosPorMes,
  ultimosMeses,
} from "../../src/features/retrospectiva/retrospectiva.calculos";

const HOJE = "2026-08-13";

describe("retrospectiva — janela de meses", () => {
  it("extrai a chave e o rótulo do mês", () => {
    expect(chaveDoMes("2026-08-13")).toBe("2026-08");
    expect(labelDoMes("2026-08")).toBe("ago");
    expect(labelDoMes("2026-01")).toBe("jan");
    expect(labelDoMes("2026-12")).toBe("dez");
  });

  it("devolve os N meses terminando no mês de hoje, em ordem", () => {
    expect(ultimosMeses(3, HOJE)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("atravessa a virada de ano", () => {
    expect(ultimosMeses(3, "2026-01-15")).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("devolve exatamente a quantidade pedida", () => {
    expect(ultimosMeses(12, HOJE)).toHaveLength(12);
    expect(ultimosMeses(1, HOJE)).toEqual(["2026-08"]);
  });
});

describe("retrospectiva — páginas por mês", () => {
  const registros = [
    { livroId: "l1", data: "2026-07-20", paginaAtual: 60 },
    { livroId: "l1", data: "2026-08-04", paginaAtual: 210 },
    { livroId: "l2", data: "2026-08-10", paginaAtual: 100 },
  ];

  it("conta o avanço (delta), não a página absoluta", () => {
    // l1: 60 em julho, +150 em agosto. l2: 100 em agosto.
    const porRegistro = paginasPorRegistro(registros);
    expect(porRegistro).toContainEqual({ mes: "2026-07", paginas: 60 });
    expect(porRegistro).toContainEqual({ mes: "2026-08", paginas: 150 });
  });

  it("soma os deltas dentro de cada mês", () => {
    const serie = paginasLidasPorMes(registros, 2, HOJE);
    expect(serie).toEqual([
      { mes: "jul", paginas: 60 },
      { mes: "ago", paginas: 250 },
    ]);
  });

  it("inclui mês sem leitura como zero, para o gráfico não ter buraco", () => {
    const serie = paginasLidasPorMes(registros, 4, HOJE);
    expect(serie.map((p) => p.mes)).toEqual(["mai", "jun", "jul", "ago"]);
    expect(serie[0]).toEqual({ mes: "mai", paginas: 0 });
  });

  it("devolve a série zerada quando não há registro nenhum", () => {
    expect(paginasLidasPorMes([], 2, HOJE)).toEqual([
      { mes: "jul", paginas: 0 },
      { mes: "ago", paginas: 0 },
    ]);
  });
});

describe("retrospectiva — tópicos por mês", () => {
  const topicos = [
    { dataAgendada: "2026-08-05", status: "ESTUDADO" },
    { dataAgendada: "2026-08-07", status: "REVISAO" },
    { dataAgendada: "2026-08-14", status: "PENDENTE" },
    { dataAgendada: "2026-07-02", status: "ESTUDADO" },
  ];

  it("conta 'estudado' e 'revisao', ignorando pendentes", () => {
    expect(topicosEstudadosPorMes(topicos, 2, HOJE)).toEqual([
      { mes: "jul", topicos: 1 },
      { mes: "ago", topicos: 2 },
    ]);
  });

  it("devolve zeros sem tópico nenhum", () => {
    expect(topicosEstudadosPorMes([], 1, HOJE)).toEqual([{ mes: "ago", topicos: 0 }]);
  });
});

describe("retrospectiva — hábitos por mês", () => {
  it("escala a meta diária pelos dias registrados no mês", () => {
    // Meta 2/dia, 3 dias registrados somando 7 -> precisa de 6, bateu.
    const serie = habitosConcluidosPorMes(
      [
        {
          frequencia: "DIARIA",
          metaValor: 2,
          registros: [
            { data: "2026-08-01", valor: 2 },
            { data: "2026-08-02", valor: 2.5 },
            { data: "2026-08-03", valor: 2.5 },
          ],
        },
      ],
      1,
      HOJE,
    );
    expect(serie).toEqual([{ mes: "ago", percentual: 100 }]);
  });

  it("marca como não cumprido quando a soma fica abaixo", () => {
    const serie = habitosConcluidosPorMes(
      [
        {
          frequencia: "DIARIA",
          metaValor: 2,
          registros: [
            { data: "2026-08-01", valor: 1 },
            { data: "2026-08-02", valor: 1 },
          ],
        },
      ],
      1,
      HOJE,
    );
    expect(serie).toEqual([{ mes: "ago", percentual: 0 }]);
  });

  it("usa a meta cheia do período em hábito semanal", () => {
    const serie = habitosConcluidosPorMes(
      [
        {
          frequencia: "SEMANAL",
          metaValor: 15,
          registros: [
            { data: "2026-08-04", valor: 8 },
            { data: "2026-08-06", valor: 7 },
          ],
        },
      ],
      1,
      HOJE,
    );
    expect(serie).toEqual([{ mes: "ago", percentual: 100 }]);
  });

  it("ignora hábito sem registro no mês, em vez de contá-lo como falha", () => {
    // Um bateu, o outro nem existia naquele mês -> 100%, não 50%.
    const serie = habitosConcluidosPorMes(
      [
        {
          frequencia: "MENSAL",
          metaValor: 10,
          registros: [{ data: "2026-08-01", valor: 10 }],
        },
        { frequencia: "MENSAL", metaValor: 10, registros: [] },
      ],
      1,
      HOJE,
    );
    expect(serie).toEqual([{ mes: "ago", percentual: 100 }]);
  });

  it("devolve 0 (e não NaN) em mês sem hábito ativo", () => {
    expect(habitosConcluidosPorMes([], 1, HOJE)).toEqual([
      { mes: "ago", percentual: 0 },
    ]);
  });
});
