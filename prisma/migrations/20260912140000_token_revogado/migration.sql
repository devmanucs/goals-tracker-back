-- CreateTable
CREATE TABLE "TokenRevogado" (
    "jti" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenRevogado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TokenRevogado_usuarioId_idx" ON "TokenRevogado"("usuarioId");

-- CreateIndex
CREATE INDEX "TokenRevogado_expiraEm_idx" ON "TokenRevogado"("expiraEm");
