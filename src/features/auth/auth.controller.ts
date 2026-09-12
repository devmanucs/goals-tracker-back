import { NextFunction, Request, Response } from "express";
import { tokenAutenticado, usuarioAutenticado } from "../../shared/middlewares/auth";
import { loginSchema, registerSchema } from "./auth.schema";
import { authService } from "./auth.service";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const usuario = await authService.register(validatedData);
      return res.status(201).json(usuario);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const resultado = await authService.login(data);
      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const usuario = await authService.me(usuarioId);
      return res.status(200).json(usuario);
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(tokenAutenticado(req));
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
