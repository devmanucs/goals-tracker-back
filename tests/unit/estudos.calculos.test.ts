import { describe, expect, it } from "vitest";
import {
  agruparPorData,
  calcularProgresso,
  topicoConcluido,
} from "../../src/features/estudos/estudos.service";

describe("estudos — progresso do concurso", () => {
  it("conta 'estudado' e 'revisao' como concluídos", () => {
    expect(topicoConcluido("ESTUDADO")).toBe(true);
    expect(topicoConcluido("REVISAO")).toBe(true);
    expect(topicoConcluido("PENDENTE")).toBe(false);
    expect(topicoConcluido("ESTUDANDO")).toBe(false);
  });

  it("calcula o percentual arredondado", () => {
    const progresso = calcularProgresso([
      { status: "ESTUDADO" },
      { status: "REVISAO" },
      { status: "PENDENTE" },
    ]);
    expect(progresso).toBe(67);
  });

  it("devolve 0 para um concurso sem tópicos (e não NaN)", () => {
    expect(calcularProgresso([])).toBe(0);
  });
});

describe("estudos — visão calendário", () => {
  it("agrupa tópicos por dataAgendada em ordem cronológica", () => {
    const calendario = agruparPorData([
      { dataAgendada: "2026-08-15", titulo: "C" },
      { dataAgendada: "2026-08-13", titulo: "A" },
      { dataAgendada: "2026-08-13", titulo: "B" },
    ]);

    expect(calendario).toHaveLength(2);
    expect(calendario[0]?.data).toBe("2026-08-13");
    expect(calendario[0]?.total).toBe(2);
    expect(calendario[1]?.data).toBe("2026-08-15");
  });

  it("devolve lista vazia sem tópicos", () => {
    expect(agruparPorData([])).toEqual([]);
  });
});
