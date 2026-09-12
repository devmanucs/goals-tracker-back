import { AppError } from "../../shared/errors/AppErrors";
import { criarProvedorOpenLibrary } from "./catalogo.openlibrary";
import { BuscarNoCatalogoQuery } from "./catalogo.schema";
import { DetalheDoCatalogo, LivroDoCatalogo, ProvedorDeCatalogo } from "./catalogo.tipos";

/**
 * Camada entre a API e o catálogo externo.
 *
 * Duas responsabilidades que o provedor não deve ter: não repetir consulta que
 * já foi feita (cache) e não deixar um usuário torrar a cota pública da Open
 * Library sozinho (limite de chamadas).
 */

// ----------------------------------------------------------------------------
// Cache em memória
// ----------------------------------------------------------------------------

/**
 * Cache simples, com validade e teto de entradas.
 *
 * Em memória de propósito: é cache de dado público e imutável na prática, e o
 * custo de errar é só uma consulta a mais. Redis aqui seria peso sem ganho.
 * O teto existe para uma sequência de buscas distintas não virar vazamento de
 * memória — ao encher, descarta a entrada mais antiga.
 */
class CacheComValidade<T> {
  private readonly entradas = new Map<string, { valor: T; expiraEm: number }>();

  constructor(
    private readonly validadeMs: number,
    private readonly maximo = 500,
  ) {}

  ler(chave: string): T | undefined {
    const entrada = this.entradas.get(chave);
    if (!entrada) return undefined;

    if (entrada.expiraEm <= Date.now()) {
      this.entradas.delete(chave);
      return undefined;
    }

    // Reinsere para o mais usado recentemente ficar no fim da ordem de inserção.
    this.entradas.delete(chave);
    this.entradas.set(chave, entrada);
    return entrada.valor;
  }

  gravar(chave: string, valor: T): void {
    if (this.entradas.size >= this.maximo) {
      const maisAntiga = this.entradas.keys().next().value;
      if (maisAntiga !== undefined) this.entradas.delete(maisAntiga);
    }
    this.entradas.set(chave, { valor, expiraEm: Date.now() + this.validadeMs });
  }

  limpar(): void {
    this.entradas.clear();
  }
}

// ----------------------------------------------------------------------------
// Limite de chamadas por usuário
// ----------------------------------------------------------------------------

/**
 * Janela deslizante por usuário. O alvo não é abuso malicioso — a rota exige
 * token — e sim um cliente com bug disparando busca a cada tecla.
 */
class LimitadorPorUsuario {
  private readonly chamadas = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
  ) {}

  registrar(usuarioId: string): void {
    const agora = Date.now();
    const recentes = (this.chamadas.get(usuarioId) ?? []).filter(
      (momento) => agora - momento < this.janelaMs,
    );

    if (recentes.length >= this.maximo) {
      throw new AppError(
        "Muitas buscas em sequência; espere alguns segundos e tente de novo",
        429,
      );
    }

    recentes.push(agora);
    this.chamadas.set(usuarioId, recentes);
  }

  limpar(): void {
    this.chamadas.clear();
  }
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

const UMA_HORA = 60 * 60 * 1000;

const cacheDeBusca = new CacheComValidade<LivroDoCatalogo[]>(UMA_HORA);
const cacheDeDetalhe = new CacheComValidade<DetalheDoCatalogo | null>(24 * UMA_HORA);
const limitador = new LimitadorPorUsuario(30, 60 * 1000);

// Trocável para os testes não tocarem a rede; em produção é a Open Library.
let provedor: ProvedorDeCatalogo = criarProvedorOpenLibrary();

/** Usado pelos testes e por quem quiser plugar outro catálogo. */
export function definirProvedorDeCatalogo(novo: ProvedorDeCatalogo): void {
  provedor = novo;
  cacheDeBusca.limpar();
  cacheDeDetalhe.limpar();
  limitador.limpar();
}

export const catalogoService = {
  async buscar(usuarioId: string, { q, limite }: BuscarNoCatalogoQuery) {
    limitador.registrar(usuarioId);

    // Normaliza a chave: "Duna " e "duna" são a mesma consulta.
    const chave = `${provedor.nome}:${q.toLowerCase()}:${limite}`;

    const emCache = cacheDeBusca.ler(chave);
    if (emCache) return { fonte: provedor.nome, cache: true, resultados: emCache };

    const resultados = await provedor.buscar(q, limite);
    cacheDeBusca.gravar(chave, resultados);

    return { fonte: provedor.nome, cache: false, resultados };
  },

  async detalhar(usuarioId: string, chaveDoLivro: string) {
    limitador.registrar(usuarioId);

    const chave = `${provedor.nome}:${chaveDoLivro}`;

    const emCache = cacheDeDetalhe.ler(chave);
    if (emCache !== undefined) {
      if (emCache === null) throw new AppError("Livro não encontrado no catálogo", 404);
      return emCache;
    }

    const detalhe = await provedor.detalhar(chaveDoLivro);
    cacheDeDetalhe.gravar(chave, detalhe);

    if (!detalhe) throw new AppError("Livro não encontrado no catálogo", 404);
    return detalhe;
  },
};
