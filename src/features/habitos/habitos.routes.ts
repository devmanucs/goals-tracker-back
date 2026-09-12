import { Router } from "express";
import { authMiddleware } from "../../shared/middlewares/auth";
import { habitosController } from "./habitos.controller";

// A anotação `: Router` é obrigatória por causa do isolamento de node_modules do pnpm.
export const habitosRoutes: Router = Router();

habitosRoutes.use(authMiddleware);

habitosRoutes.get("/", habitosController.listar);
habitosRoutes.post("/", habitosController.criar);
habitosRoutes.get("/:id", habitosController.obter);
habitosRoutes.patch("/:id", habitosController.atualizar);
habitosRoutes.delete("/:id", habitosController.deletar);

habitosRoutes.get("/:id/registros", habitosController.listarRegistros);
habitosRoutes.post("/:id/registros", habitosController.criarRegistro);
habitosRoutes.get("/:id/progresso-atual", habitosController.progressoAtual);
habitosRoutes.get("/:id/streak", habitosController.streak);

/** Registros avulsos (por id próprio), montado em /registros-habito. */
export const registrosHabitoRoutes: Router = Router();

registrosHabitoRoutes.use(authMiddleware);
registrosHabitoRoutes.patch("/:id", habitosController.atualizarRegistro);
registrosHabitoRoutes.delete("/:id", habitosController.deletarRegistro);
