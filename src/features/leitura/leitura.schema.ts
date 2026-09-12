import { z } from "zod";
import { FORMATO_DATA } from "../../shared/utils/datas";
import { criarMapeadorDeEnum } from "../../shared/utils/enums";
import { StatusLivro } from "../../../generated/prisma/enums";

/**
 * Status como o frontend os conhece (lower_snake_case). O banco guarda em
 * UPPER_SNAKE_CASE, então a conversão passa sempre pelo mapeador abaixo.
 */
export const statusLivroApi = z.enum([
  "quero_ler",
  "lendo",
  "lido",
  "abandonado",
]);

export const mapaStatusLivro = criarMapeadorDeEnum<
  z.infer<typeof statusLivroApi>,
  StatusLivro
>({
  quero_ler: "QUERO_LER",
  lendo: "LENDO",
  lido: "LIDO",
  abandonado: "ABANDONADO",
});

// ----------------------------------------------------------------------------
// Livro
// ----------------------------------------------------------------------------

/**
 * Campos do livro SEM valores default. O schema de criação adiciona os defaults
 * por cima; o de atualização parte daqui. Derivar o PATCH de um schema que já
 * tem `.default()` não funciona: o default sobrevive ao `.partial()` e um corpo
 * vazio passaria a valer como "atualize o status".
 */
const camposLivro = z.object({
  titulo: z.string().min(1, "O título é obrigatório"),
  autor: z.string().min(1, "O autor é obrigatório"),
  totalPaginas: z
    .number()
    .int("O total de páginas deve ser um número inteiro")
    .positive("O total de páginas deve ser maior que zero"),
  status: statusLivroApi,
  // Cor de fundo do card, usada quando não há capa (ex: "var(--chart-3)").
  corCapa: z.string().max(60).optional(),

  // Preenchidos pela busca externa; ausentes num cadastro feito na mão.
  capaUrl: z.string().url("A URL da capa é inválida").max(500).optional(),
  sinopse: z.string().max(5000).optional(),
  isbn: z.string().max(20).optional(),
  anoPublicacao: z
    .number()
    .int("O ano deve ser inteiro")
    .min(1000, "Ano inválido")
    .max(new Date().getFullYear() + 1, "Ano inválido")
    .optional(),
});

export const criarLivroSchema = camposLivro.extend({
  status: statusLivroApi.default("quero_ler"),
});

/** PATCH /livros/:id — todos os campos opcionais, mas ao menos um obrigatório. */
export const atualizarLivroSchema = camposLivro
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

/** GET /livros?status=lendo */
export const listarLivrosQuerySchema = z.object({
  status: statusLivroApi.optional(),
});

// ----------------------------------------------------------------------------
// Registro de leitura
// ----------------------------------------------------------------------------

export const criarRegistroSchema = z.object({
  data: z.string().regex(FORMATO_DATA, "A data deve estar no formato YYYY-MM-DD"),
  paginaAtual: z
    .number()
    .int("A página atual deve ser um número inteiro")
    .min(0, "A página atual não pode ser negativa"),
  observacao: z.string().max(500).optional(),
});

// criarRegistroSchema não tem defaults, então derivar o PATCH dele é seguro.
export const atualizarRegistroSchema = criarRegistroSchema
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

// ----------------------------------------------------------------------------
// Estatísticas
// ----------------------------------------------------------------------------

/** GET /leitura/estatisticas?de=YYYY-MM-DD&ate=YYYY-MM-DD — período opcional. */
export const estatisticasQuerySchema = z.object({
  de: z.string().regex(FORMATO_DATA, "Use o formato YYYY-MM-DD").optional(),
  ate: z.string().regex(FORMATO_DATA, "Use o formato YYYY-MM-DD").optional(),
});

export type CriarLivroInput = z.infer<typeof criarLivroSchema>;
export type AtualizarLivroInput = z.infer<typeof atualizarLivroSchema>;
export type ListarLivrosQuery = z.infer<typeof listarLivrosQuerySchema>;
export type CriarRegistroInput = z.infer<typeof criarRegistroSchema>;
export type AtualizarRegistroInput = z.infer<typeof atualizarRegistroSchema>;
export type EstatisticasQuery = z.infer<typeof estatisticasQuerySchema>;
export type StatusLivroApi = z.infer<typeof statusLivroApi>;
