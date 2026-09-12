-- CreateTable
CREATE TABLE "Concurso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "banca" TEXT NOT NULL,
    "dataProva" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANEJANDO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Concurso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicoEstudo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "concursoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "materia" TEXT NOT NULL,
    "peso" INTEGER NOT NULL,
    "dataAgendada" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicoEstudo_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Habito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "frequencia" TEXT NOT NULL DEFAULT 'DIARIA',
    "metaValor" REAL NOT NULL,
    "icone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistroHabito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitoId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "valor" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroHabito_habitoId_fkey" FOREIGN KEY ("habitoId") REFERENCES "Habito" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Livro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "totalPaginas" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUERO_LER',
    "corCapa" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Livro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Livro" ("autor", "createdAt", "id", "status", "titulo", "totalPaginas", "usuarioId") SELECT "autor", "createdAt", "id", "status", "titulo", "totalPaginas", "usuarioId" FROM "Livro";
DROP TABLE "Livro";
ALTER TABLE "new_Livro" RENAME TO "Livro";
CREATE INDEX "Livro_usuarioId_idx" ON "Livro"("usuarioId");
CREATE TABLE "new_RegistroLeitura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "livroId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "paginaAtual" INTEGER NOT NULL,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroLeitura_livroId_fkey" FOREIGN KEY ("livroId") REFERENCES "Livro" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RegistroLeitura" ("createdAt", "data", "id", "livroId", "observacao", "paginaAtual") SELECT "createdAt", "data", "id", "livroId", "observacao", "paginaAtual" FROM "RegistroLeitura";
DROP TABLE "RegistroLeitura";
ALTER TABLE "new_RegistroLeitura" RENAME TO "RegistroLeitura";
CREATE INDEX "RegistroLeitura_livroId_idx" ON "RegistroLeitura"("livroId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Concurso_usuarioId_idx" ON "Concurso"("usuarioId");

-- CreateIndex
CREATE INDEX "TopicoEstudo_concursoId_idx" ON "TopicoEstudo"("concursoId");

-- CreateIndex
CREATE INDEX "TopicoEstudo_dataAgendada_idx" ON "TopicoEstudo"("dataAgendada");

-- CreateIndex
CREATE INDEX "Habito_usuarioId_idx" ON "Habito"("usuarioId");

-- CreateIndex
CREATE INDEX "RegistroHabito_habitoId_idx" ON "RegistroHabito"("habitoId");
