import { z } from "zod";

/** GET /livros/buscar-externo?q=duna&limite=8 */
export const buscarNoCatalogoSchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Busque por pelo menos 2 caracteres")
    .max(120, "Termo de busca muito longo"),
  // Teto baixo de propósito: a lista é um seletor, não um catálogo para navegar.
  // Segurar o limite também protege a cota da API pública de terceiro.
  limite: z.coerce
    .number()
    .int("O limite deve ser inteiro")
    .min(1)
    .max(20, "O limite máximo é 20")
    .default(8),
});

export type BuscarNoCatalogoQuery = z.infer<typeof buscarNoCatalogoSchema>;

/**
 * GET /livros/buscar-externo/detalhe?chave=/works/OL27448W
 *
 * A chave vai como parâmetro de query, e não no caminho, porque ela contém
 * barras ("/works/OL123W") — no caminho exigiria escape e wildcard na rota.
 */
export const detalharDoCatalogoSchema = z.object({
  chave: z
    .string()
    .trim()
    .min(1, "Informe a chave do livro no catálogo")
    .max(200, "Chave inválida"),
});

export type DetalharDoCatalogoQuery = z.infer<typeof detalharDoCatalogoSchema>;
