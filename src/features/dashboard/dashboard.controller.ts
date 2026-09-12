import { NextFunction, Request, Response } from "express";
import { usuarioAutenticado } from "../../shared/middlewares/auth";
import { dashboardService } from "./dashboard.service";

export const dashboardController = {
  async resumo(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const resumo = await dashboardService.resumo(usuarioId);
      return res.status(200).json(resumo);
    } catch (err) {
      next(err);
    }
  },
};
