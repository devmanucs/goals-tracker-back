import { z } from "zod";

/**
 * GET /retrospectiva?meses=6
 *
 * `coerce` porque query string chega sempre como texto. O teto de 60 meses
 * evita que alguém peça 10.000 pontos e derrube a resposta.
 */
export const retrospectivaQuerySchema = z.object({
  meses: z.coerce
    .number()
    .int("O número de meses deve ser inteiro")
    .min(1, "O mínimo é 1 mês")
    .max(60, "O máximo é 60 meses")
    .default(6),
});

export type RetrospectivaQuery = z.infer<typeof retrospectivaQuerySchema>;
