import { Router } from "express";
import { authMiddleware } from "../../shared/middlewares/auth";
import { estudosController } from "./estudos.controller";

// A anotação `: Router` é obrigatória por causa do isolamento de node_modules do pnpm.
export const concursosRoutes: Router = Router();

concursosRoutes.use(authMiddleware);

concursosRoutes.get("/", estudosController.listarConcursos);
concursosRoutes.post("/", estudosController.criarConcurso);
concursosRoutes.get("/:id", estudosController.obterConcurso);
concursosRoutes.patch("/:id", estudosController.atualizarConcurso);
concursosRoutes.delete("/:id", estudosController.deletarConcurso);

concursosRoutes.get("/:id/topicos", estudosController.listarTopicos);
concursosRoutes.post("/:id/topicos", estudosController.criarTopico);
concursosRoutes.get("/:id/calendario", estudosController.calendarioDoConcurso);
concursosRoutes.get("/:id/progresso", estudosController.progresso);
concursosRoutes.get("/:id/dias-ate-prova", estudosController.diasAteProva);

/** Tópicos avulsos (por id próprio), montado em /topicos. */
export const topicosRoutes: Router = Router();

topicosRoutes.use(authMiddleware);
topicosRoutes.get("/:id", estudosController.obterTopico);
topicosRoutes.patch("/:id", estudosController.atualizarTopico);
topicosRoutes.delete("/:id", estudosController.deletarTopico);

/** Endpoints derivados do módulo, montado em /estudos. */
export const estudosRoutes: Router = Router();

estudosRoutes.use(authMiddleware);
estudosRoutes.get("/proximo-topico", estudosController.proximoTopico);
estudosRoutes.get("/calendario", estudosController.calendarioGeral);
