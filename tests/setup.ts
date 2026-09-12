// Roda antes de cada arquivo de teste, e antes de qualquer import da aplicação.
process.env.DATABASE_URL = "file:./prisma/test.db";
process.env.JWT_SECRET = "segredo-de-teste";
