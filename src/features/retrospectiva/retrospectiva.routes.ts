import { Router } from "express";
import { authMiddleware } from "../../shared/middlewares/auth";
import { retrospectivaController } from "./retrospectiva.controller";

// A anotação `: Router` é obrigatória por causa do isolamento de node_modules do pnpm.
export const retrospectivaRoutes: Router = Router();

retrospectivaRoutes.use(authMiddleware);

// GET /retrospectiva?meses=6
retrospectivaRoutes.get("/", retrospectivaController.gerar);
