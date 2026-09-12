# Collection Bruno — Goals Tracker API

Collection de API para bater na API local durante o desenvolvimento.
[Bruno](https://www.usebruno.com/) é offline e guarda tudo em arquivo, então esta
pasta é versionada junto com o código e acompanha as mudanças de contrato.

## Como abrir

1. Instale o Bruno (`brew install bruno` no macOS, ou baixe em usebruno.com).
2. **Open Collection** → aponte para esta pasta (`bruno/`).
3. No seletor de ambiente, no canto superior direito, escolha **Local**.

## Como usar

Suba a API antes (`pnpm dev`, em `http://localhost:3333`). Depois:

1. **`01 Auth / Register`** — cria a conta. Rode uma vez só; na segunda dá 409.
2. **`01 Auth / Login`** — **rode sempre este primeiro.** O script de pós-resposta
   salva o token em `{{token}}`, e a collection inteira usa esse valor como Bearer
   (configurado uma vez em `collection.bru`, herdado por todas as requisições).
3. Daí em diante, qualquer requisição funciona.

As requisições de criação também salvam o id do recurso no ambiente
(`{{livroId}}`, `{{concursoId}}`, `{{topicoId}}`, `{{habitoId}}`…), então dá para
rodar uma pasta de cima para baixo sem copiar id na mão: criar → detalhar →
atualizar → deletar.

Parâmetros de query opcionais vêm **desabilitados** (com `~` na frente). Marque o
checkbox na aba *Query* para ativar.

## O que tem

| Pasta | Conteúdo |
|---|---|
| `00 Saude` | `/health` — confere se o servidor subiu |
| `01 Auth` | register, login, me, logout |
| `02 Leitura` | livros, registros de progresso, estatísticas |
| `03 Estudos` | concursos, tópicos, calendário, progresso, dias até a prova |
| `04 Habitos` | hábitos, registros, progresso do período, streak |
| `05 Agregados` | dashboard e retrospectiva |
| `06 Erros esperados` | 401, 400 de validação, PATCH vazio, 404 de outro usuário |

A pasta `06` existe para você ver o formato de erro sem precisar quebrar nada de
propósito — inclusive o 404 (e não 403) de recurso de outro usuário, que é
proposital: responder 403 confirmaria que aquele id existe.

## Depois de mexer no logout

`01 Auth / Logout` **revoga o token de verdade**. Depois de rodá-lo, todas as
outras requisições passam a dar 401 até você rodar o `Login` de novo.
