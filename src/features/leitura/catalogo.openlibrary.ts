import { AppError } from "../../shared/errors/AppErrors";
import {
  DetalheDoCatalogo,
  LivroDoCatalogo,
  ProvedorDeCatalogo,
} from "./catalogo.tipos";

/**
 * Provedor de catálogo baseado na Open Library (openlibrary.org).
 *
 * Escolhida por ser aberta de verdade: não exige chave de API nem cadastro.
 *
 * O parsing aqui é deliberadamente tolerante — cada campo é opcional e vem
 * validado um a um. É uma API pública de terceiro: ela pode mudar o formato,
 * omitir campo ou devolver tipo diferente do documentado, e nada disso pode
 * derrubar a busca. Na dúvida o campo vira `null` e o resto segue.
 */

const BASE_PADRAO = "https://openlibrary.org";
const BASE_CAPAS = "https://covers.openlibrary.org";

/** A Open Library pede um User-Agent que identifique quem está chamando. */
const USER_AGENT =
  "goals-tracker/1.0 (+https://github.com/devmanucs/goals-tracker-back)";

const TIMEOUT_MS = 8_000;

// ----------------------------------------------------------------------------
// Leitura defensiva de JSON desconhecido
// ----------------------------------------------------------------------------

function comoObjeto(valor: unknown): Record<string, unknown> {
  return typeof valor === "object" && valor !== null
    ? (valor as Record<string, unknown>)
    : {};
}

function comoTexto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : null;
}

function comoInteiroPositivo(valor: unknown): number | null {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

/** Primeiro item de texto de um array, ignorando o que não for texto. */
function primeiroTexto(valor: unknown): string | null {
  if (!Array.isArray(valor)) return null;
  for (const item of valor) {
    const texto = comoTexto(item);
    if (texto) return texto;
  }
  return null;
}

/**
 * A descrição da Open Library vem ora como texto, ora como `{ value: texto }`.
 * As duas formas aparecem no mesmo endpoint, dependendo do registro.
 */
function comoDescricao(valor: unknown): string | null {
  const direto = comoTexto(valor);
  if (direto) return direto;
  return comoTexto(comoObjeto(valor)["value"]);
}

// ----------------------------------------------------------------------------
// Normalização
// ----------------------------------------------------------------------------

function urlDaCapa(coverId: unknown, tamanho: "M" | "L"): string | null {
  const id = comoInteiroPositivo(coverId);
  return id ? `${BASE_CAPAS}/b/id/${id}-${tamanho}.jpg` : null;
}

/** Um item de `docs[]` do /search.json. */
function normalizarResultado(bruto: unknown): LivroDoCatalogo | null {
  const doc = comoObjeto(bruto);

  // Sem chave ou sem título o item é inútil para a interface — descarta.
  const chave = comoTexto(doc["key"]);
  const titulo = comoTexto(doc["title"]);
  if (!chave || !titulo) return null;

  return {
    chave,
    titulo,
    autor: primeiroTexto(doc["author_name"]),
    // number_of_pages_median é a mediana entre as edições: é a melhor
    // aproximação disponível na busca, já que cada edição tem uma paginação.
    totalPaginas: comoInteiroPositivo(doc["number_of_pages_median"]),
    capaUrl: urlDaCapa(doc["cover_i"], "M"),
    anoPublicacao: comoInteiroPositivo(doc["first_publish_year"]),
    isbn: primeiroTexto(doc["isbn"]),
  };
}

// ----------------------------------------------------------------------------
// Provedor
// ----------------------------------------------------------------------------

export function criarProvedorOpenLibrary(
  opcoes: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): ProvedorDeCatalogo {
  const base = (opcoes.baseUrl ?? process.env.CATALOGO_BASE_URL ?? BASE_PADRAO)
    .replace(/\/+$/, "");
  // Injetável para os testes não dependerem de rede.
  const buscarNaRede = opcoes.fetchImpl ?? fetch;

  async function pedirJson(caminho: string): Promise<unknown> {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let resposta: Response;
    try {
      resposta = await buscarNaRede(`${base}${caminho}`, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: controlador.signal,
      });
    } catch (erro) {
      // Timeout, DNS, recusa de conexão: é indisponibilidade de terceiro, e
      // 503 diz isso melhor do que 500.
      const motivo = erro instanceof Error ? erro.message : String(erro);
      throw new AppError(
        `Não foi possível consultar o catálogo de livros (${motivo})`,
        503,
      );
    } finally {
      clearTimeout(timer);
    }

    if (resposta.status === 404) return null;

    if (!resposta.ok) {
      throw new AppError(
        `O catálogo de livros respondeu ${resposta.status}`,
        resposta.status === 429 ? 429 : 503,
      );
    }

    try {
      return await resposta.json();
    } catch {
      throw new AppError("O catálogo de livros devolveu uma resposta inválida", 503);
    }
  }

  return {
    nome: "openlibrary",

    async buscar(termo, limite) {
      const query = new URLSearchParams({
        q: termo,
        limit: String(limite),
        // Pedir só os campos usados deixa a resposta muito menor — a busca
        // completa traz dezenas de campos por item.
        fields: [
          "key",
          "title",
          "author_name",
          "number_of_pages_median",
          "cover_i",
          "first_publish_year",
          "isbn",
        ].join(","),
      });

      const dados = comoObjeto(await pedirJson(`/search.json?${query}`));
      const docs = Array.isArray(dados["docs"]) ? dados["docs"] : [];

      return docs
        .map(normalizarResultado)
        .filter((livro): livro is LivroDoCatalogo => livro !== null);
    },

    async detalhar(chave) {
      // A chave da busca já vem como "/works/OL123W"; aceitamos os dois
      // formatos para a rota não depender de o cliente ter guardado a barra.
      const caminho = chave.startsWith("/") ? chave : `/works/${chave}`;
      const dados = await pedirJson(`${caminho}.json`);
      if (dados === null) return null;

      const obra = comoObjeto(dados);
      const titulo = comoTexto(obra["titulo"]) ?? comoTexto(obra["title"]);
      if (!titulo) return null;

      const capas = Array.isArray(obra["covers"]) ? obra["covers"] : [];

      return {
        chave: comoTexto(obra["key"]) ?? caminho,
        titulo,
        // O endpoint de obra não traz autor legível (só referências), nem
        // paginação — esses vêm do resultado da busca, que o cliente já tem.
        autor: null,
        totalPaginas: null,
        capaUrl: urlDaCapa(capas[0], "L"),
        anoPublicacao: null,
        isbn: null,
        sinopse: comoDescricao(obra["description"]),
        assuntos: Array.isArray(obra["subjects"])
          ? obra["subjects"]
              .map(comoTexto)
              .filter((a): a is string => a !== null)
              .slice(0, 8)
          : [],
      };
    },
  };
}
