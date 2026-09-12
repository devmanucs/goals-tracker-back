import { Router } from "express";
import { authMiddleware } from "../../shared/middlewares/auth";
import { authController } from "./auth.controller";

// A anotação `: Router` é obrigatória por causa do isolamento de node_modules do pnpm.
export const authRoutes: Router = Router();

// Públicas
authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);

// Exigem token — o middleware é aplicado rota a rota para não afetar as de cima.
authRoutes.get("/me", authMiddleware, authController.me);
authRoutes.post("/logout", authMiddleware, authController.logout);