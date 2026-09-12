import { describe, expect, it } from "vitest";
import { criarProvedorOpenLibrary } from "../../src/features/leitura/catalogo.openlibrary";
import { AppError } from "../../src/shared/errors/AppErrors";

/**
 * Estes testes exercitam a NORMALIZAÇÃO, com respostas montadas à mão no
 * formato documentado da Open Library. Eles garantem que campo faltando ou com
 * tipo inesperado não derruba a busca — não que o formato real é esse.
 *
 * Quem confirma o formato real é `pnpm verificar:catalogo`, que bate na API de
 * verdade (ver scripts/verificar-catalogo.ts).
 */
function provedorComResposta(corpo: unknown, status = 200) {
  const fetchFalso = (async () =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

  return criarProvedorOpenLibrary({ baseUrl: "https://exemplo.test", fetchImpl: fetchFalso });
}

describe("catálogo — normalização da busca", () => {
  it("converte um resultado completo", async () => {
    const provedor = provedorComResposta({
      docs: [
        {
          key: "/works/OL27448W",
          title: "Duna",
          author_name: ["Frank Herbert"],
          number_of_pages_median: 688,
          cover_i: 12345,
          first_publish_year: 1965,
          isbn: ["9780441172719"],
        },
      ],
    });

    const [livro] = await provedor.buscar("duna", 5);

    expect(livro).toEqual({
      chave: "/works/OL27448W",
      titulo: "Duna",
      autor: "Frank Herbert",
      totalPaginas: 688,
      capaUrl: "https://covers.openlibrary.org/b/id/12345-M.jpg",
      anoPublicacao: 1965,
      isbn: "9780441172719",
    });
  });

  it("aceita item sem páginas, sem capa, sem autor e sem ano", async () => {
    const provedor = provedorComResposta({
      docs: [{ key: "/works/OL1W", title: "Livro Obscuro" }],
    });

    const [livro] = await provedor.buscar("obscuro", 5);

    expect(livro).toMatchObject({
      titulo: "Livro Obscuro",
      autor: null,
      totalPaginas: null,
      capaUrl: null,
      anoPublicacao: null,
      isbn: null,
    });
  });

  it("descarta item sem chave ou sem título em vez de quebrar", async () => {
    const provedor = provedorComResposta({
      docs: [
        { title: "Sem chave" },
        { key: "/works/OL2W" },
        { key: "/works/OL3W", title: "Válido" },
      ],
    });

    const resultados = await provedor.buscar("x", 5);

    expect(resultados).toHaveLength(1);
    expect(resultados[0]?.titulo).toBe("Válido");
  });

  it("ignora campo com tipo inesperado", async () => {
    const provedor = provedorComResposta({
      docs: [
        {
          key: "/works/OL4W",
          title: "Tipos Errados",
          author_name: "não é array",
          number_of_pages_median: "muitas",
          cover_i: null,
          first_publish_year: -5,
        },
      ],
    });

    const [livro] = await provedor.buscar("x", 5);

    expect(livro).toMatchObject({
      titulo: "Tipos Errados",
      autor: null,
      totalPaginas: null,
      capaUrl: null,
      anoPublicacao: null,
    });
  });

  it("devolve lista vazia quando docs não vem", async () => {
    const provedor = provedorComResposta({});
    expect(await provedor.buscar("nada", 5)).toEqual([]);
  });

  it("não confunde string vazia com valor", async () => {
    const provedor = provedorComResposta({
      docs: [{ key: "/works/OL5W", title: "Ok", author_name: ["   ", "Autor Real"] }],
    });

    const [livro] = await provedor.buscar("x", 5);
    expect(livro?.autor).toBe("Autor Real");
  });
});

describe("catálogo — normalização do detalhe", () => {
  it("aceita descrição como texto", async () => {
    const provedor = provedorComResposta({
      key: "/works/OL27448W",
      title: "Duna",
      description: "Em um futuro distante...",
      covers: [12345],
      subjects: ["Ficção científica", "Deserto"],
    });

    const detalhe = await provedor.detalhar("/works/OL27448W");

    expect(detalhe).toMatchObject({
      titulo: "Duna",
      sinopse: "Em um futuro distante...",
      capaUrl: "https://covers.openlibrary.org/b/id/12345-L.jpg",
      assuntos: ["Ficção científica", "Deserto"],
    });
  });

  it("aceita descrição no formato { value }", async () => {
    // As duas formas aparecem no mesmo endpoint, dependendo do registro.
    const provedor = provedorComResposta({
      key: "/works/OL1W",
      title: "Outro",
      description: { type: "/type/text", value: "Sinopse aninhada" },
    });

    const detalhe = await provedor.detalhar("/works/OL1W");
    expect(detalhe?.sinopse).toBe("Sinopse aninhada");
  });

  it("devolve sinopse nula quando não há descrição", async () => {
    const provedor = provedorComResposta({ key: "/works/OL1W", title: "Sem sinopse" });
    const detalhe = await provedor.detalhar("/works/OL1W");
    expect(detalhe?.sinopse).toBeNull();
  });

  it("aceita chave sem a barra inicial", async () => {
    const provedor = provedorComResposta({ key: "/works/OL9W", title: "Ok" });
    expect(await provedor.detalhar("OL9W")).not.toBeNull();
  });

  it("devolve null quando o provedor responde 404", async () => {
    const provedor = provedorComResposta({}, 404);
    expect(await provedor.detalhar("/works/OL404W")).toBeNull();
  });
});

describe("catálogo — falhas do provedor", () => {
  it("traduz erro de rede em 503, não em 500", async () => {
    const fetchQueFalha = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;

    const provedor = criarProvedorOpenLibrary({
      baseUrl: "https://exemplo.test",
      fetchImpl: fetchQueFalha,
    });

    await expect(provedor.buscar("x", 5)).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it("repassa 429 do provedor como 429", async () => {
    const provedor = provedorComResposta({}, 429);
    await expect(provedor.buscar("x", 5)).rejects.toMatchObject({ statusCode: 429 });
  });

  it("trata corpo que não é JSON como indisponibilidade", async () => {
    const fetchComLixo = (async () =>
      new Response("<html>erro</html>", { status: 200 })) as unknown as typeof fetch;

    const provedor = criarProvedorOpenLibrary({
      baseUrl: "https://exemplo.test",
      fetchImpl: fetchComLixo,
    });

    await expect(provedor.buscar("x", 5)).rejects.toBeInstanceOf(AppError);
  });
});
