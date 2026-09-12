/**
 * Catálogo externo de livros.
 *
 * O provedor fica atrás desta interface de propósito: trocar Open Library por
 * Google Books (ou por um catálogo local) é implementar isto de novo, sem
 * mexer no service, no controller nem no frontend.
 */

/** Um resultado de busca — o suficiente para a pessoa escolher na lista. */
export interface LivroDoCatalogo {
  /** Identificador no provedor. Opaco para o resto do sistema. */
  chave: string;
  titulo: string;
  autor: string | null;
  totalPaginas: number | null;
  capaUrl: string | null;
  anoPublicacao: number | null;
  isbn: string | null;
}

/** O detalhe carrega o que é caro demais para trazer em cada item da lista. */
export interface DetalheDoCatalogo extends LivroDoCatalogo {
  sinopse: string | null;
  assuntos: string[];
}

export interface ProvedorDeCatalogo {
  /** Nome do provedor, para log e para a resposta dizer de onde veio o dado. */
  readonly nome: string;
  buscar(termo: string, limite: number): Promise<LivroDoCatalogo[]>;
  /** `null` quando o provedor não conhece a chave. */
  detalhar(chave: string): Promise<DetalheDoCatalogo | null>;
}
