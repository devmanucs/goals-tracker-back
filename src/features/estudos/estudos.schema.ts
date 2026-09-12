import { z } from "zod";
import { FORMATO_DATA } from "../../shared/utils/datas";
import { criarMapeadorDeEnum } from "../../shared/utils/enums";
import { StatusConcurso, StatusTopico } from "../../../generated/prisma/enums";

// ----------------------------------------------------------------------------
// Enums da API (lower_snake) <-> enums do banco (UPPER_SNAKE)
// ----------------------------------------------------------------------------

export const statusConcursoApi = z.enum(["planejando", "estudando", "encerrado"]);

export const mapaStatusConcurso = criarMapeadorDeEnum<
  z.infer<typeof statusConcursoApi>,
  StatusConcurso
>({
  planejando: "PLANEJANDO",
  estudando: "ESTUDANDO",
  encerrado: "ENCERRADO",
});

export const statusTopicoApi = z.enum([
  "pendente",
  "estudando",
  "estudado",
  "revisao",
]);

export const mapaStatusTopico = criarMapeadorDeEnum<
  z.infer<typeof statusTopicoApi>,
  StatusTopico
>({
  pendente: "PENDENTE",
  estudando: "ESTUDANDO",
  estudado: "ESTUDADO",
  revisao: "REVISAO",
});

const dataISO = (mensagem: string) => z.string().regex(FORMATO_DATA, mensagem);

// ----------------------------------------------------------------------------
// Concurso
// ----------------------------------------------------------------------------

/**
 * Campos SEM default: o PATCH é derivado daqui porque `.default()` sobrevive ao
 * `.partial()` e faria um corpo vazio passar como atualização válida.
 */
const camposConcurso = z.object({
  titulo: z.string().min(1, "O título é obrigatório"),
  banca: z.string().min(1, "A banca é obrigatória"),
  dataProva: dataISO("A data da prova deve estar no formato YYYY-MM-DD"),
  status: statusConcursoApi,
});

export const criarConcursoSchema = camposConcurso.extend({
  status: statusConcursoApi.default("planejando"),
});

export const atualizarConcursoSchema = camposConcurso
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

// ----------------------------------------------------------------------------
// Tópico de estudo
// ----------------------------------------------------------------------------

const camposTopico = z.object({
  titulo: z.string().min(1, "O título é obrigatório"),
  materia: z.string().min(1, "A matéria é obrigatória"),
  // Peso/prioridade do tópico no edital (1 = irrelevante, 10 = decisivo).
  peso: z
    .number()
    .int("O peso deve ser um número inteiro")
    .min(1, "O peso mínimo é 1")
    .max(10, "O peso máximo é 10"),
  dataAgendada: dataISO("A data agendada deve estar no formato YYYY-MM-DD"),
  status: statusTopicoApi,
});

export const criarTopicoSchema = camposTopico.extend({
  status: statusTopicoApi.default("pendente"),
});

export const atualizarTopicoSchema = camposTopico
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

/** GET /concursos/:id/topicos?ordenarPor=peso|data&status=pendente */
export const listarTopicosQuerySchema = z.object({
  ordenarPor: z.enum(["peso", "data"]).default("data"),
  status: statusTopicoApi.optional(),
});

/** GET /concursos/:id/calendario?de=...&ate=... — janela opcional. */
export const calendarioQuerySchema = z.object({
  de: dataISO("Use o formato YYYY-MM-DD").optional(),
  ate: dataISO("Use o formato YYYY-MM-DD").optional(),
});

export type CriarConcursoInput = z.infer<typeof criarConcursoSchema>;
export type AtualizarConcursoInput = z.infer<typeof atualizarConcursoSchema>;
export type CriarTopicoInput = z.infer<typeof criarTopicoSchema>;
export type AtualizarTopicoInput = z.infer<typeof atualizarTopicoSchema>;
export type ListarTopicosQuery = z.infer<typeof listarTopicosQuerySchema>;
export type CalendarioQuery = z.infer<typeof calendarioQuerySchema>;
