import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Prepara o banco de teste (prisma/test.db) antes de qualquer suíte.
    globalSetup: ["./tests/globalSetup.ts"],
    // Define as variáveis de ambiente ANTES dos módulos da aplicação serem
    // importados — prisma.ts lê DATABASE_URL no momento do import.
    setupFiles: ["./tests/setup.ts"],
    // Os testes de integração compartilham um único arquivo SQLite, então
    // rodam em série para não disputarem as mesmas tabelas.
    fileParallelism: false,
  },
});
