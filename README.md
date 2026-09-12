# goals-tracker-back

API do Goals Tracker — Express 5 + Prisma 7 + SQLite (dev), em TypeScript.
O frontend fica em [devmanucs/goals-tracker](https://github.com/devmanucs/goals-tracker).

## Rodando o projeto

```bash
pnpm install
cp .env.example .env          # e preencha JWT_SECRET
pnpm prisma:migrate           # aplica as migrations no dev.db
pnpm prisma:generate          # gera o client em ./generated/prisma
pnpm dev                      # http://localhost:3333
```

## Scripts

| Script | O que faz |
|---|---|
| `pnpm dev` | Servidor com hot reload (tsx watch) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Suíte vitest (unit + integração) |
| `pnpm test:watch` | Vitest em modo watch |
| `pnpm prisma:migrate` | `prisma migrate dev` |
| `pnpm prisma:generate` | Regenera o Prisma Client |
| `pnpm prisma:studio` | Abre o Prisma Studio |

## Arquitetura

Camadas por feature, em `src/features/<modulo>/`:

```
<modulo>.routes.ts      → registra endpoints, sem lógica
<modulo>.controller.ts  → parseia com zod, chama o service, formata a resposta HTTP
<modulo>.service.ts     → regra de negócio, lança AppError em erro esperado
<modulo>.repository.ts  → só queries Prisma
<modulo>.schema.ts      → zod schemas + z.infer dos tipos de input
```

Compartilhado em `src/shared/`:

- `lib/prisma.ts` — client único, com driver adapter do SQLite.
  **O Prisma Client é gerado em `../generated/prisma`, não em `@prisma/client`.**
- `middlewares/auth.ts` — valida o JWT e injeta `req.usuarioId`.
- `middlewares/errorHandler.ts` — formata AppError e ZodError.
- `errors/AppErrors.ts` — erro de negócio com status HTTP.
- `utils/datas.ts` — conversão entre `YYYY-MM-DD` (API) e `DateTime` (banco).
- `utils/enums.ts` — conversão entre enums lower_snake (API) e UPPER_SNAKE (banco).

### Regras do projeto

- **Todo `Router()` exportado precisa da anotação `: Router`.** Sem ela o TypeScript
  não consegue nomear o tipo inferido por causa do isolamento de `node_modules` do pnpm.
- **Isolamento multiusuário é inegociável.** Toda rota que lê ou escreve dados de
  Livro, Concurso, TopicoEstudo, Habito ou RegistroHabito passa pelo `authMiddleware`
  e filtra por `req.usuarioId`. Recurso de outro usuário devolve **404**, não 403:
  responder 403 confirmaria que aquele id existe.
- **Datas trafegam como `YYYY-MM-DD`** e são convertidas para `DateTime` na fronteira.
- **Enums trafegam em lower_snake** (`quero_ler`) e são convertidos para o
  UPPER_SNAKE do Prisma (`QUERO_LER`) na fronteira.

## Endpoints

Tudo exige `Authorization: Bearer <token>`, exceto `/auth/*` e `/health`.

### Auth
| Método | Rota |
|---|---|
| POST | `/auth/register` |
| POST | `/auth/login` |

### Leitura
| Método | Rota |
|---|---|
| GET/POST | `/livros` (GET aceita `?status=lendo`) |
| GET/PATCH/DELETE | `/livros/:id` |
| GET/POST | `/livros/:id/registros` |
| PATCH/DELETE | `/registros-leitura/:id` |
| GET | `/leitura/estatisticas?de=&ate=` |

### Estudos
| Método | Rota |
|---|---|
| GET/POST | `/concursos` |
| GET/PATCH/DELETE | `/concursos/:id` |
| GET/POST | `/concursos/:id/topicos` (GET aceita `?ordenarPor=peso\|data&status=`) |
| GET | `/concursos/:id/calendario?de=&ate=` |
| GET | `/concursos/:id/progresso` |
| GET | `/concursos/:id/dias-ate-prova` |
| GET/PATCH/DELETE | `/topicos/:id` |
| GET | `/estudos/proximo-topico` |
| GET | `/estudos/calendario?de=&ate=` |

### Hábitos
| Método | Rota |
|---|---|
| GET/POST | `/habitos` |
| GET/PATCH/DELETE | `/habitos/:id` |
| GET/POST | `/habitos/:id/registros` (GET aceita `?de=&ate=`) |
| GET | `/habitos/:id/progresso-atual` |
| GET | `/habitos/:id/streak` |
| PATCH/DELETE | `/registros-habito/:id` |

### Dashboard
| Método | Rota |
|---|---|
| GET | `/dashboard` |

## Formato de erro

```json
{ "error": { "message": "Livro não encontrado" } }
```

Erros de validação incluem `code: "VALIDACAO"` e a lista `issues`:

```json
{
  "error": {
    "message": "Dados inválidos",
    "code": "VALIDACAO",
    "issues": [{ "campo": "totalPaginas", "mensagem": "O total de páginas deve ser maior que zero" }]
  }
}
```

## Testes

```bash
pnpm test
```

- `tests/unit/` — funções puras (streak, progresso, páginas lidas, datas, enums).
  Não tocam no banco.
- `tests/integracao/` — rotas de ponta a ponta com supertest, incluindo os testes
  de isolamento entre usuários.

Os testes usam um banco próprio (`prisma/test.db`), recriado a cada execução pelo
`tests/globalSetup.ts`. O `dev.db` nunca é tocado.
