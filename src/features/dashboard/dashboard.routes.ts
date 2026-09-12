import { Router } from "express";
import { authMiddleware } from "../../shared/middlewares/auth";
import { dashboardController } from "./dashboard.controller";

// A anotação `: Router` é obrigatória por causa do isolamento de node_modules do pnpm.
export const dashboardRoutes: Router = Router();

dashboardRoutes.use(authMiddleware);

// GET /dashboard — resumo agregado dos três módulos.
dashboardRoutes.get("/", dashboardController.resumo);
