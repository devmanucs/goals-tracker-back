import { describe, expect, it } from "vitest";
import {
  diasEntre,
  paraData,
  paraISO,
  somarDias,
} from "../../src/shared/utils/datas";

describe("utils/datas", () => {
  it("converte ISO para Date em UTC e de volta sem perder o dia", () => {
    expect(paraISO(paraData("2026-08-13"))).toBe("2026-08-13");
  });

  it("não escorrega para o dia anterior em fusos negativos", () => {
    // O bug clássico: new Date("2026-01-01") interpretado no fuso local.
    expect(paraData("2026-01-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("calcula a diferença em dias", () => {
    expect(diasEntre("2026-08-01", "2026-08-13")).toBe(12);
    expect(diasEntre("2026-08-13", "2026-08-01")).toBe(-12);
    expect(diasEntre("2026-08-13", "2026-08-13")).toBe(0);
  });

  it("atravessa a virada de mês e de ano ao somar dias", () => {
    expect(somarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
  });
});
