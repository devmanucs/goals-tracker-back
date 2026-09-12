import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// O Prisma Client 7 exige um driver adapter explícito. O client é gerado em
// ../generated/prisma (ver `output` no schema.prisma), e NÃO em @prisma/client.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = new PrismaClient({ adapter });
