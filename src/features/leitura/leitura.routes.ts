import { Router } from "express";
import { authMiddleware } from "../../shared/middlewares/auth";
import { leituraController } from "./leitura.controller";

// A anotação `: Router` é obrigatória: sem ela o TypeScript não consegue nomear
// o tipo inferido por causa de como o pnpm isola o node_modules do express.
export const livrosRoutes: Router = Router();

// Tudo abaixo é escopado ao usuário do token — nenhuma rota de livro é pública.
livrosRoutes.use(authMiddleware);

livrosRoutes.get("/", leituraController.listarLivros);
livrosRoutes.post("/", leituraController.criarLivro);
livrosRoutes.get("/:id", leituraController.obterLivro);
livrosRoutes.patch("/:id", leituraController.atualizarLivro);
livrosRoutes.delete("/:id", leituraController.deletarLivro);

livrosRoutes.get("/:id/registros", leituraController.listarRegistros);
livrosRoutes.post("/:id/registros", leituraController.criarRegistro);

/** Registros avulsos (editar/remover por id próprio), montado em /registros-leitura. */
export const registrosLeituraRoutes: Router = Router();

registrosLeituraRoutes.use(authMiddleware);
registrosLeituraRoutes.patch("/:id", leituraController.atualizarRegistro);
registrosLeituraRoutes.delete("/:id", leituraController.deletarRegistro);

/** Endpoints derivados do módulo, montado em /leitura. */
export const leituraRoutes: Router = Router();

leituraRoutes.use(authMiddleware);
leituraRoutes.get("/estatisticas", leituraController.estatisticas);
