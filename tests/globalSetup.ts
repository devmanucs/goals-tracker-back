import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const URL_TESTE = "file:./prisma/test.db";

/**
 * Recria o banco de teste do zero uma vez por execução do vitest.
 * Usa `prisma db push --url` (e não `migrate dev`) de propósito: é mais rápido,
 * não grava nada na pasta de migrations e nunca toca no dev.db do projeto.
 * O arquivo é apagado antes do push, então não é preciso `--force-reset`
 * (que é destrutivo e exige confirmação explícita).
 */
export default function setup() {
  const caminho = resolve(process.cwd(), "prisma/test.db");
  for (const arquivo of [caminho, `${caminho}-journal`]) {
    if (existsSync(arquivo)) rmSync(arquivo);
  }

  try {
    execFileSync(
      "npx",
      ["prisma", "db", "push", "--url", URL_TESTE],
      { stdio: "pipe", encoding: "utf8" },
    );
  } catch (err) {
    const erro = err as { stderr?: string; stdout?: string };
    throw new Error(
      `Falha ao preparar o banco de teste:\n${erro.stderr ?? erro.stdout ?? String(err)}`,
    );
  }
}
