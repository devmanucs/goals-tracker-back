// O contrato da API usa datas no formato "YYYY-MM-DD" (string), como o frontend já
// faz em src/lib/dates.ts. No banco elas são DateTime, então a conversão acontece
// sempre na fronteira: schema (entrada) e controller/service (saída).

/** Regex de validação do formato aceito pela API. */
export const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte "2026-08-13" para um Date fixado em meia-noite UTC.
 * Usar UTC evita que o fuso do servidor empurre a data para o dia anterior/seguinte.
 */
export function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Converte um Date do banco de volta para "YYYY-MM-DD". */
export function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Data de hoje no formato da API. */
export function hojeISO(): string {
  return paraISO(new Date());
}

/** Diferença em dias inteiros entre duas datas ISO (b - a). */
export function diasEntre(a: string, b: string): number {
  const ms = paraData(b).getTime() - paraData(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Soma (ou subtrai, com valor negativo) dias a uma data ISO. */
export function somarDias(iso: string, dias: number): string {
  const data = paraData(iso);
  data.setUTCDate(data.getUTCDate() + dias);
  return paraISO(data);
}
