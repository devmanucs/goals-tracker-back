/**
 * O banco guarda os enums em UPPER_SNAKE_CASE (convenção do Prisma), enquanto o
 * contrato com o frontend usa lower_snake_case ("quero_ler", "revisao", ...).
 * Este factory cria o par de conversores a partir de um único mapa, garantindo
 * que os dois lados nunca saiam de sincronia.
 */
export function criarMapeadorDeEnum<Api extends string, Db extends string>(
  mapa: Record<Api, Db>,
) {
  const inverso = Object.fromEntries(
    Object.entries(mapa).map(([api, db]) => [db, api]),
  ) as Record<Db, Api>;

  return {
    /** Valor da API -> valor persistido no banco. */
    paraDb: (valor: Api): Db => mapa[valor],
    /** Valor do banco -> valor devolvido na resposta HTTP. */
    paraApi: (valor: Db): Api => inverso[valor],
  };
}
