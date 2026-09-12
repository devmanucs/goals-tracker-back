import "dotenv/config";
import { z } from "zod";

/**
 * Configuração do ambiente, validada UMA vez, no boot.
 *
 * Antes disso, `JWT_SECRET` era lido direto de `process.env` com um
 * `as string` por cima. O servidor subia normalmente, o /health respondia `ok`,
 * e só o primeiro login estourava — com "secretOrPrivateKey must have a value",
 * um erro interno do jsonwebtoken que não diz o que fazer.
 *
 * Falhar no boot, dizendo exatamente o que falta, custa um arquivo e evita esse
 * tipo de caça ao tesouro.
 */
const ehProducao = process.env.NODE_ENV === "production";

const esquema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),

  JWT_SECRET: z
    .string({ message: "JWT_SECRET não está definida" })
    .min(1, "JWT_SECRET não pode ser vazia")
    // Em desenvolvimento qualquer valor serve; em produção um segredo curto é
    // adivinhável, e com ele um token forjado passa pelo authMiddleware.
    .refine((valor) => !ehProducao || valor.length >= 32, {
      message: "Em produção, JWT_SECRET precisa de ao menos 32 caracteres",
    }),

  PORT: z.coerce.number().int().positive().default(3333),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
    .join("\n");

  console.error(
    [
      "",
      "Não foi possível iniciar: a configuração de ambiente está incompleta.",
      "",
      problemas,
      "",
      "Crie o arquivo .env na raiz do projeto a partir do exemplo:",
      "",
      "  cp .env.example .env              # macOS/Linux",
      "  Copy-Item .env.example .env       # Windows (PowerShell)",
      "",
      "e preencha os valores. O .env não é versionado.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

export const env = resultado.data;
