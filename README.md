# goals-tracker-back

API do Goals Tracker — Express 5 + Prisma 7 + SQLite (dev), em TypeScript.
O frontend fica em [devmanucs/goals-tracker](https://github.com/devmanucs/goals-tracker).

## Rodando o projeto

```bash
cp .env.example .env          # e preencha JWT_SECRET
pnpm load                     # http://localhost:3333
```

O `.env` não é opcional: o servidor valida a configuração no boot e recusa
iniciar se faltar alguma variável, dizendo qual. Antes ele subia sem `JWT_SECRET`
e só quebrava no primeiro login, com um "secretOrPrivateKey must have a value"
vindo de dentro do jsonwebtoken.

`pnpm load` faz tudo: instala, gera o Prisma Client, aplica as migrations,
typecheca e sobe o servidor. Serve tanto no primeiro clone quanto depois de um
`git pull` — usa `migrate deploy`, que é idempotente e não pergunta nada.

O passo das migrations não é enfeite: sem ele o servidor sobe e o `/health`
responde `ok`, mas qualquer rota que toque no banco devolve 500, porque o SQLite
cria o arquivo vazio ao conectar e não há tabela nenhuma — uma falha que parece
"está rodando" e só aparece no primeiro cadastro.

Para o dia a dia, `pnpm dev` sozinho basta.

Nem o `dev.db` nem o `./generated/prisma` são versionados — os dois são
recriados a partir do que está no repositório.

O Prisma Client é gerado automaticamente: no `postinstall` e também dentro de
`dev`, `build`, `typecheck` e `test`. Isso é de propósito. Como a pasta
`generated/` é ignorada pelo git, um `git pull` que traga schema novo deixaria o
client velho no seu disco, e o typecheck falharia com dezenas de erros do tipo
"Property 'concurso' does not exist" ou "has no exported member 'StatusTopico'" —
que parecem erro de código, mas são só client desatualizado. Gerar custa ~150 ms;
perder meia hora atrás desse erro custa mais.

Se ainda assim aparecer: `pnpm prisma:generate`.

### `pnpm load` não cria o banco

`load` é `install` + `build` + `dev`. Ele resolve dependências e client, mas **não
aplica migrations** — então num clone novo, ou depois de um `git pull` que traga
migration nova, rode antes:

```bash
pnpm prisma:migrate
```

Sem isso o servidor sobe e o `/health` responde `ok`, mas qualquer rota que toque
no banco devolve 500 — o SQLite cria o arquivo vazio ao conectar, sem nenhuma
tabela. É uma falha que parece "está rodando" e só aparece no primeiro cadastro.

## Scripts

| Script | O que faz |
|---|---|
| `pnpm load` | `install` + `build` + `dev`, em sequência |
| `pnpm dev` | Servidor com hot reload (tsx watch) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Suíte vitest (unit + integração) |
| `pnpm smoke` | Sobe o servidor e bate no `/health` |
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
| GET | `/auth/me` |
| POST | `/auth/logout` |

### Leitura
| Método | Rota |
|---|---|
| GET/POST | `/livros` (GET aceita `?status=lendo`) |
| GET/PATCH/DELETE | `/livros/:id` |
| GET | `/livros/buscar-externo?q=&limite=` |
| GET | `/livros/buscar-externo/detalhe?chave=` |
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

### Dashboard e retrospectiva
| Método | Rota |
|---|---|
| GET | `/dashboard` |
| GET | `/retrospectiva?meses=6` |

## Catálogo externo de livros

`/livros/buscar-externo` é um proxy para a [Open Library](https://openlibrary.org),
escolhida por ser aberta de verdade — não exige chave de API nem cadastro. A busca
devolve o suficiente para escolher na lista (título, autor, páginas, capa, ano,
ISBN); a sinopse vem no `/detalhe`, porque buscá-la para cada item da lista custaria
uma requisição por resultado.

O provedor fica atrás da interface `ProvedorDeCatalogo` (`catalogo.tipos.ts`):
trocar por Google Books ou por um catálogo local é implementar a interface de novo,
sem tocar no service, no controller nem no frontend.

Três decisões que valem saber:

- **Exige token**, apesar de ser só um proxy de busca. Sem isso qualquer um usaria
  nosso servidor para consultar a Open Library em nome da nossa aplicação.
- **Cache em memória** (1h para busca, 24h para detalhe, com teto de entradas) e
  **limite de 30 buscas por minuto por usuário** — o alvo não é abuso, é um cliente
  com bug disparando busca a cada tecla.
- **Parsing tolerante**: é API pública de terceiro, pode mudar de formato ou omitir
  campo. Na dúvida o campo vira `null` e o resto segue; resultado sem título ou sem
  chave é descartado.

```bash
pnpm verificar:catalogo          # confere o normalizador contra a API real
pnpm verificar:catalogo duna
```

Esse script existe porque os testes usam respostas montadas à mão: eles provam que
campo faltando não derruba a busca, não que o formato real é aquele. Fica fora do
CI de propósito — depende de rede e de serviço de terceiro.

## Logout

JWT é stateless, então um logout que só responde 204 deixaria o token valendo
pelos 7 dias restantes. Aqui o login assina o token com um `jti`, o logout grava
esse `jti` na tabela `TokenRevogado` e o `authMiddleware` recusa qualquer token
que esteja lá.

Só o token da requisição é revogado — deslogar num dispositivo não derruba os
outros. Tokens antigos, assinados antes do `jti` existir, não são revogáveis: em
vez de fingir sucesso, o logout devolve 400 pedindo um login novo. Cada logout
aproveita para apagar as revogações já vencidas, então a tabela não cresce sem
limite e não precisa de job agendado.

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

## Testando pelo Bruno

A pasta [`bruno/`](bruno/) é uma collection do [Bruno](https://www.usebruno.com/)
com todas as rotas, versionada junto com o código. Abra a pasta no Bruno, escolha
o ambiente **Local** e rode `01 Auth / Login` primeiro — ele salva o token e a
collection inteira herda. Ver [bruno/README.md](bruno/README.md).

## Testes

```bash
pnpm test    # vitest
pnpm smoke   # sobe o servidor de verdade e bate no /health
```

São **234 testes**, em duas camadas:

- `tests/unit/` — o que dá para exercitar sem banco:
  - cálculos: streak nas três frequências, progresso de concurso, páginas lidas
    por delta, séries da retrospectiva, datas e enums;
  - `errorHandler.test.ts` — cada tipo de erro no formato combinado com o front,
    e que um erro inesperado vira 500 genérico sem vazar a mensagem interna;
  - `auth.middleware.test.ts` — header ausente, assinatura errada, token
    expirado, token revogado por logout, e que **falha de banco na denylist vira
    500, não 401** (senão um banco fora do ar deslogaria todo mundo);
  - `catalogo.service.test.ts` — o cache (validade, normalização da chave,
    404 lembrado) e o limite de 30 chamadas por minuto por usuário;
  - `env.test.ts` — o processo morre com mensagem quando falta `JWT_SECRET`, e
    exige segredo de 32+ caracteres em produção.
- `tests/integracao/` — rotas de ponta a ponta com supertest, incluindo os testes
  de isolamento entre usuários.

Os testes usam um banco próprio (`prisma/test.db`), recriado a cada execução pelo
`tests/globalSetup.ts`. O `dev.db` nunca é tocado.

O `pnpm smoke` cobre o que o typecheck não pega: que o processo realmente sobe,
que o `/health` responde e que rota protegida exige token. Uma configuração
quebrada do Prisma Client, por exemplo, só aparece aí.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em todo pull request:
instala com lockfile travado, gera o Prisma Client, faz typecheck, **aplica as
migrations num banco do zero** e confere que elas batem com o schema, roda os
testes e o smoke.
