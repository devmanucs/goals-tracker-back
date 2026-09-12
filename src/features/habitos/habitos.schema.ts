import { z } from "zod";
import { FORMATO_DATA } from "../../shared/utils/datas";
import { criarMapeadorDeEnum } from "../../shared/utils/enums";
import { FrequenciaHabito } from "../../../generated/prisma/enums";

export const frequenciaApi = z.enum(["diaria", "semanal", "mensal"]);

export const mapaFrequencia = criarMapeadorDeEnum<
  z.infer<typeof frequenciaApi>,
  FrequenciaHabito
>({
  diaria: "DIARIA",
  semanal: "SEMANAL",
  mensal: "MENSAL",
});

/**
 * Campos SEM default: o PATCH é derivado daqui porque `.default()` sobrevive ao
 * `.partial()` e faria um corpo vazio passar como atualização válida.
 */
const camposHabito = z.object({
  nome: z.string().min(1, "O nome é obrigatório"),
  // Unidade do contador: "L", "km", "min", "vezes"...
  unidade: z.string().min(1, "A unidade é obrigatória").max(20),
  frequencia: frequenciaApi,
  metaValor: z.number().positive("A meta deve ser maior que zero"),
  icone: z.string().max(40).optional(),
});

export const criarHabitoSchema = camposHabito.extend({
  frequencia: frequenciaApi.default("diaria"),
});

export const atualizarHabitoSchema = camposHabito
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const criarRegistroHabitoSchema = z.object({
  data: z.string().regex(FORMATO_DATA, "A data deve estar no formato YYYY-MM-DD"),
  valor: z.number().min(0, "O valor não pode ser negativo"),
});

export const atualizarRegistroHabitoSchema = criarRegistroHabitoSchema
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

/** GET /habitos/:id/registros?de=...&ate=... */
export const listarRegistrosQuerySchema = z.object({
  de: z.string().regex(FORMATO_DATA, "Use o formato YYYY-MM-DD").optional(),
  ate: z.string().regex(FORMATO_DATA, "Use o formato YYYY-MM-DD").optional(),
});

export type CriarHabitoInput = z.infer<typeof criarHabitoSchema>;
export type AtualizarHabitoInput = z.infer<typeof atualizarHabitoSchema>;
export type CriarRegistroHabitoInput = z.infer<typeof criarRegistroHabitoSchema>;
export type AtualizarRegistroHabitoInput = z.infer<
  typeof atualizarRegistroHabitoSchema
>;
export type ListarRegistrosQuery = z.infer<typeof listarRegistrosQuerySchema>;
export type FrequenciaApi = z.infer<typeof frequenciaApi>;
