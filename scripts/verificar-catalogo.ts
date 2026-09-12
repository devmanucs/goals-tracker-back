/**
 * Confere o normalizador do catálogo contra a Open Library DE VERDADE.
 *
 *   pnpm verificar:catalogo            # busca por "torto arado"
 *   pnpm verificar:catalogo duna
 *
 * Por que existe: os testes de `catalogo.openlibrary.test.ts` usam respostas
 * montadas à mão. Eles provam que campo faltando não derruba a busca, mas não
 * provam que o formato real da API é aquele. Este script fecha essa lacuna com
 * uma chamada real — rode uma vez depois de mexer no normalizador, ou se a
 * busca começar a vir vazia sem explicação.
 *
 * Fica fora do CI de propósito: depende de rede e de um serviço de terceiro,
 * e um teste que falha por causa do provedor estar fora do ar vira ruído.
 */
import { criarProvedorOpenLibrary } from "../src/features/leitura/catalogo.openlibrary.js";

const termo = process.argv.slice(2).join(" ") || "torto arado";

function marcar(ok: boolean) {
  return ok ? "ok  " : "AUSENTE";
}

async function main() {
  const provedor = criarProvedorOpenLibrary();

  console.log(`Buscando "${termo}" na Open Library...\n`);
  const resultados = await provedor.buscar(termo, 5);

  if (resultados.length === 0) {
    console.error(
      "FALHOU: a busca não devolveu nenhum resultado.\n" +
        "Ou o termo não existe no acervo, ou o formato da resposta mudou e o\n" +
        "normalizador em catalogo.openlibrary.ts precisa acompanhar.",
    );
    process.exit(1);
  }

  console.log(`${resultados.length} resultados. Cobertura dos campos:\n`);
  const cobertura = {
    titulo: 0,
    autor: 0,
    totalPaginas: 0,
    capaUrl: 0,
    anoPublicacao: 0,
    isbn: 0,
  };

  for (const livro of resultados) {
    if (livro.titulo) cobertura.titulo++;
    if (livro.autor) cobertura.autor++;
    if (livro.totalPaginas) cobertura.totalPaginas++;
    if (livro.capaUrl) cobertura.capaUrl++;
    if (livro.anoPublicacao) cobertura.anoPublicacao++;
    if (livro.isbn) cobertura.isbn++;
    console.log(
      `  ${livro.titulo}\n` +
        `    autor=${livro.autor ?? "-"}  páginas=${livro.totalPaginas ?? "-"}  ` +
        `ano=${livro.anoPublicacao ?? "-"}\n` +
        `    capa=${livro.capaUrl ?? "-"}\n` +
        `    chave=${livro.chave}\n`,
    );
  }

  console.log("Preenchimento (de %d resultados):", resultados.length);
  for (const [campo, total] of Object.entries(cobertura)) {
    console.log(`  ${campo.padEnd(14)} ${total}/${resultados.length}`);
  }

  // O título é o único campo sem o qual a interface não funciona.
  if (cobertura.titulo < resultados.length) {
    console.error("\nFALHOU: resultado sem título — o normalizador deveria descartá-lo.");
    process.exit(1);
  }

  const primeira = resultados[0];
  if (!primeira) return;

  console.log(`\nBuscando o detalhe de "${primeira.titulo}"...\n`);
  const detalhe = await provedor.detalhar(primeira.chave);

  if (!detalhe) {
    console.error("FALHOU: o detalhe voltou vazio para uma chave vinda da busca.");
    process.exit(1);
  }

  console.log(`  titulo   ${marcar(Boolean(detalhe.titulo))}  ${detalhe.titulo}`);
  console.log(
    `  sinopse  ${marcar(Boolean(detalhe.sinopse))}  ` +
      `${detalhe.sinopse ? `${detalhe.sinopse.slice(0, 90)}...` : "(esta obra não tem)"}`,
  );
  console.log(`  capa     ${marcar(Boolean(detalhe.capaUrl))}  ${detalhe.capaUrl ?? ""}`);
  console.log(`  assuntos ${detalhe.assuntos.join(", ") || "(nenhum)"}`);

  console.log(
    "\nOk: a Open Library respondeu e o normalizador entendeu a resposta.\n" +
      "Sinopse ausente num livro específico é normal — nem toda obra tem descrição.",
  );
}

main().catch((erro) => {
  console.error("\nFALHOU ao consultar a Open Library:", erro?.message ?? erro);
  console.error(
    "\nSe for timeout ou DNS, é rede. Se for 403/429, é limite do provedor.\n" +
      "Se a resposta veio mas o normalizador não entendeu, o formato mudou.",
  );
  process.exit(1);
});
