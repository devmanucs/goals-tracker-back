import { describe, expect, it } from "vitest";
import {
  calcularStreak,
  fimDoPeriodo,
  inicioDoPeriodo,
  periodoAnterior,
  progressoPeriodoAtual,
  somarPorPeriodo,
} from "../../src/features/habitos/habitos.calculos";

// Quinta-feira. Serve de "hoje" fixo em todos os testes abaixo.
const HOJE = "2026-08-13";

describe("hábitos — janelas de período", () => {
  it("período diário é o próprio dia", () => {
    expect(inicioDoPeriodo(HOJE, "DIARIA")).toBe(HOJE);
    expect(fimDoPeriodo(HOJE, "DIARIA")).toBe(HOJE);
  });

  it("período semanal começa na segunda-feira", () => {
    // 2026-08-13 é quinta; a segunda daquela semana é 2026-08-10.
    expect(inicioDoPeriodo(HOJE, "SEMANAL")).toBe("2026-08-10");
    expect(fimDoPeriodo("2026-08-10", "SEMANAL")).toBe("2026-08-16");
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    // 2026-08-16 é domingo — não pode abrir uma semana nova.
    expect(inicioDoPeriodo("2026-08-16", "SEMANAL")).toBe("2026-08-10");
  });

  it("período mensal vai do dia 1 ao último dia do mês", () => {
    expect(inicioDoPeriodo(HOJE, "MENSAL")).toBe("2026-08-01");
    expect(fimDoPeriodo("2026-08-01", "MENSAL")).toBe("2026-08-31");
    expect(fimDoPeriodo("2026-02-01", "MENSAL")).toBe("2026-02-28");
  });

  it("o período anterior recua corretamente em cada frequência", () => {
    expect(periodoAnterior("2026-08-01", "DIARIA")).toBe("2026-07-31");
    expect(periodoAnterior("2026-08-10", "SEMANAL")).toBe("2026-08-03");
    expect(periodoAnterior("2026-01-01", "MENSAL")).toBe("2025-12-01");
  });
});

describe("hábitos — progresso do período vigente", () => {
  const registros = [
    { data: "2026-08-10", valor: 1 },
    { data: "2026-08-12", valor: 2 },
    { data: "2026-08-13", valor: 1.2 },
    // Fora da semana atual: não pode entrar na conta.
    { data: "2026-08-09", valor: 99 },
  ];

  it("soma apenas os registros do período semanal vigente", () => {
    const progresso = progressoPeriodoAtual(registros, "SEMANAL", 15, HOJE);
    expect(progresso.inicio).toBe("2026-08-10");
    expect(progresso.fim).toBe("2026-08-16");
    expect(progresso.atual).toBe(4.2);
    expect(progresso.batido).toBe(false);
  });

  it("soma vários registros do mesmo dia no período diário", () => {
    const progresso = progressoPeriodoAtual(
      [
        { data: HOJE, valor: 1.5 },
        { data: HOJE, valor: 0.7 },
      ],
      "DIARIA",
      2,
      HOJE,
    );
    expect(progresso.atual).toBe(2.2);
    expect(progresso.batido).toBe(true);
  });

  it("limita o percentual em 100 mesmo estourando a meta", () => {
    const progresso = progressoPeriodoAtual([{ data: HOJE, valor: 10 }], "DIARIA", 2, HOJE);
    expect(progresso.percentual).toBe(100);
  });

  it("arredonda a soma de floats para uma casa", () => {
    const progresso = progressoPeriodoAtual(
      [
        { data: HOJE, valor: 0.1 },
        { data: HOJE, valor: 0.2 },
      ],
      "DIARIA",
      1,
      HOJE,
    );
    expect(progresso.atual).toBe(0.3);
  });

  it("devolve zerado quando não há registro no período", () => {
    const progresso = progressoPeriodoAtual([], "DIARIA", 2, HOJE);
    expect(progresso).toMatchObject({ atual: 0, percentual: 0, batido: false });
  });
});

describe("hábitos — soma por período", () => {
  it("agrupa registros semanais pela segunda-feira de cada semana", () => {
    const totais = somarPorPeriodo(
      [
        { data: "2026-08-04", valor: 5 },
        { data: "2026-08-06", valor: 6 },
        { data: "2026-08-11", valor: 4 },
      ],
      "SEMANAL",
    );
    expect(totais.get("2026-08-03")).toBe(11);
    expect(totais.get("2026-08-10")).toBe(4);
  });
});

describe("hábitos — streak", () => {
  it("conta dias consecutivos batendo a meta", () => {
    const streak = calcularStreak(
      [
        { data: "2026-08-11", valor: 2 },
        { data: "2026-08-12", valor: 2.2 },
        { data: "2026-08-13", valor: 2.4 },
      ],
      "DIARIA",
      2,
      HOJE,
    );
    expect(streak.atual).toBe(3);
    expect(streak.periodoAtualBatido).toBe(true);
  });

  it("quebra a sequência num dia abaixo da meta", () => {
    const streak = calcularStreak(
      [
        { data: "2026-08-10", valor: 2 },
        { data: "2026-08-11", valor: 0.5 }, // abaixo da meta
        { data: "2026-08-12", valor: 2 },
        { data: "2026-08-13", valor: 2 },
      ],
      "DIARIA",
      2,
      HOJE,
    );
    expect(streak.atual).toBe(2);
  });

  it("não zera o streak só porque o período vigente ainda está em andamento", () => {
    // Ontem e anteontem bateram; hoje ainda não. O streak segue valendo 2.
    const streak = calcularStreak(
      [
        { data: "2026-08-11", valor: 2 },
        { data: "2026-08-12", valor: 2 },
      ],
      "DIARIA",
      2,
      HOJE,
    );
    expect(streak.atual).toBe(2);
    expect(streak.periodoAtualBatido).toBe(false);
  });

  it("conta semanas consecutivas somando os registros de cada semana", () => {
    const streak = calcularStreak(
      [
        // Semana de 03/08: 8 + 7 = 15 -> bateu.
        { data: "2026-08-04", valor: 8 },
        { data: "2026-08-06", valor: 7 },
        // Semana de 10/08: 10 + 5 = 15 -> bateu.
        { data: "2026-08-11", valor: 10 },
        { data: "2026-08-13", valor: 5 },
      ],
      "SEMANAL",
      15,
      HOJE,
    );
    expect(streak.atual).toBe(2);
  });

  it("conta meses consecutivos", () => {
    const streak = calcularStreak(
      [
        { data: "2026-06-10", valor: 100 },
        { data: "2026-07-10", valor: 100 },
        { data: "2026-08-10", valor: 100 },
      ],
      "MENSAL",
      100,
      HOJE,
    );
    expect(streak.atual).toBe(3);
  });

  it("guarda o recorde histórico mesmo depois de a sequência quebrar", () => {
    const streak = calcularStreak(
      [
        // Sequência antiga de 4 dias.
        { data: "2026-07-01", valor: 2 },
        { data: "2026-07-02", valor: 2 },
        { data: "2026-07-03", valor: 2 },
        { data: "2026-07-04", valor: 2 },
        // Sequência atual de 1 dia.
        { data: "2026-08-13", valor: 2 },
      ],
      "DIARIA",
      2,
      HOJE,
    );
    expect(streak.atual).toBe(1);
    expect(streak.recorde).toBe(4);
  });

  it("devolve tudo zerado sem registros", () => {
    expect(calcularStreak([], "DIARIA", 2, HOJE)).toEqual({
      atual: 0,
      periodoAtualBatido: false,
      recorde: 0,
    });
  });
});
