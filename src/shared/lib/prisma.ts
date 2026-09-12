import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { env } from "../config/env";

// O Prisma Client 7 exige um driver adapter explícito. O client é gerado em
// ../generated/prisma (ver `output` no schema.prisma), e NÃO em @prisma/client.
const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
