import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// `dotenv/config` leria o .env da máquina e mudaria o resultado conforme quem
// roda o teste. Aqui o ambiente é montado à mão, caso a caso.
vi.mock("dotenv/config", () => ({}));

const ORIGINAL = { ...process.env };

/**
 * Importa `config/env` do zero com o ambiente informado.
 *
 * Devolve ou o `env` validado, ou o código com que o processo teria morrido —
 * o módulo chama `process.exit(1)` quando a configuração não presta.
 */
async function carregar(ambiente: Record<string, string | undefined>) {
  for (const chave of Object.keys(process.env)) delete process.env[chave];
  for (const [chave, valor] of Object.entries(ambiente)) {
    if (valor !== undefined) process.env[chave] = valor;
  }

  const saida = vi.spyOn(process, "exit").mockImplementation(((codigo?: number) => {
    throw new Error(`process.exit:${codigo}`);
  }) as never);
  vi.spyOn(console, "error").mockImplementation(() => {});

  vi.resetModules();
  try {
    const modulo = await import("../../src/shared/config/env.js");
    return { env: modulo.env, morreu: false as const };
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith("process.exit:")) {
      return { env: undefined, morreu: true as const, codigo: Number(erro.message.split(":")[1]) };
    }
    throw erro;
  } finally {
    saida.mockRestore();
  }
}

const VALIDO = { JWT_SECRET: "segredo-de-teste", DATABASE_URL: "file:./prisma/test.db" };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const chave of Object.keys(process.env)) delete process.env[chave];
  Object.assign(process.env, ORIGINAL);
  vi.resetModules();
});

describe("config/env", () => {
  it("aceita um ambiente válido", async () => {
    const { env, morreu } = await carregar(VALIDO);

    expect(morreu).toBe(false);
    expect(env?.JWT_SECRET).toBe("segredo-de-teste");
    expect(env?.DATABASE_URL).toBe("file:./prisma/test.db");
  });

  it("assume o banco local quando DATABASE_URL não vem", async () => {
    const { env } = await carregar({ JWT_SECRET: "segredo-de-teste" });

    expect(env?.DATABASE_URL).toBe("file:./dev.db");
  });

  it("assume a porta 3333 quando PORT não vem", async () => {
    const { env } = await carregar(VALIDO);

    expect(env?.PORT).toBe(3333);
  });

  it("converte PORT para número, não deixa string passar", async () => {
    const { env } = await carregar({ ...VALIDO, PORT: "4000" });

    expect(env?.PORT).toBe(4000);
  });

  it("mata o processo quando JWT_SECRET não existe", async () => {
    // Era o bug real: sem ela o servidor subia e só quebrava no primeiro login.
    const resultado = await carregar({ DATABASE_URL: "file:./dev.db" });

    expect(resultado.morreu).toBe(true);
    expect(resultado.codigo).toBe(1);
  });

  it("mata o processo quando JWT_SECRET é vazia", async () => {
    expect((await carregar({ JWT_SECRET: "" })).morreu).toBe(true);
  });

  it("mata o processo quando PORT não é número", async () => {
    expect((await carregar({ ...VALIDO, PORT: "porta" })).morreu).toBe(true);
  });

  it("mata o processo quando PORT é negativa", async () => {
    expect((await carregar({ ...VALIDO, PORT: "-1" })).morreu).toBe(true);
  });

  it("aceita segredo curto fora de produção", async () => {
    const { morreu } = await carregar({ ...VALIDO, NODE_ENV: "development", JWT_SECRET: "curto" });

    expect(morreu).toBe(false);
  });

  it("recusa segredo curto em produção", async () => {
    const { morreu } = await carregar({ ...VALIDO, NODE_ENV: "production", JWT_SECRET: "curto" });

    expect(morreu).toBe(true);
  });

  it("aceita em produção um segredo de 32 caracteres ou mais", async () => {
    const { morreu, env } = await carregar({
      ...VALIDO,
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
    });

    expect(morreu).toBe(false);
    expect(env?.JWT_SECRET).toHaveLength(32);
  });

  it("explica o que faltou, em vez de morrer calado", async () => {
    await carregar({ DATABASE_URL: "file:./dev.db" });

    const impresso = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .join("\n");
    expect(impresso).toContain("JWT_SECRET");
  });
});
