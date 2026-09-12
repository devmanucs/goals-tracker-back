/**
 * Teste de fumaça: sobe o servidor de verdade e bate no /health.
 *
 * O `typecheck` não pega tudo — uma falha de configuração do Prisma Client, por
 * exemplo, só aparece quando o processo realmente sobe. Este script existe para
 * o CI reprovar esse tipo de problema antes do merge.
 *
 * Usa um banco próprio e descartável; nunca toca no dev.db.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Server } from "node:http";

const BANCO = "file:./prisma/smoke.db";
const PORTA = 3999;

function prepararBanco() {
  const caminho = resolve(process.cwd(), "prisma/smoke.db");
  for (const arquivo of [caminho, `${caminho}-journal`]) {
    if (existsSync(arquivo)) rmSync(arquivo);
  }
  // db push e não migrate deploy: o objetivo é ter as tabelas, não validar o
  // histórico de migrations (isso os testes de integração já cobrem).
  execFileSync("npx", ["prisma", "db", "push", "--url", BANCO], { stdio: "pipe" });
}

async function main() {
  process.env.DATABASE_URL = BANCO;
  process.env.JWT_SECRET ??= "smoke";

  prepararBanco();

  // Importado depois das variáveis de ambiente: prisma.ts lê DATABASE_URL no
  // import. A extensão .js é exigida pelo moduleResolution nodenext.
  const { app } = await import("../src/app.js");

  const servidor: Server = await new Promise((ok) => {
    const s = app.listen(PORTA, () => ok(s));
  });

  try {
    const resposta = await fetch(`http://localhost:${PORTA}/health`);
    const corpo = (await resposta.json()) as { status?: string };

    if (!resposta.ok || corpo.status !== "ok") {
      throw new Error(`/health respondeu ${resposta.status}: ${JSON.stringify(corpo)}`);
    }

    // Uma rota protegida precisa recusar quem não tem token.
    const semToken = await fetch(`http://localhost:${PORTA}/livros`);
    if (semToken.status !== 401) {
      throw new Error(`/livros sem token deveria dar 401, deu ${semToken.status}`);
    }

    console.log("Smoke ok: servidor sobe, /health responde e rota protegida exige token.");
  } finally {
    servidor.close();
    const caminho = resolve(process.cwd(), "prisma/smoke.db");
    for (const arquivo of [caminho, `${caminho}-journal`]) {
      if (existsSync(arquivo)) rmSync(arquivo);
    }
  }
}

main().catch((erro) => {
  console.error("Smoke falhou:", erro);
  process.exit(1);
});
