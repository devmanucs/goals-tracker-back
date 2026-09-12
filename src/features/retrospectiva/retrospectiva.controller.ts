import { NextFunction, Request, Response } from "express";
import { usuarioAutenticado } from "../../shared/middlewares/auth";
import { retrospectivaQuerySchema } from "./retrospectiva.schema";
import { retrospectivaService } from "./retrospectiva.service";

export const retrospectivaController = {
  async gerar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const query = retrospectivaQuerySchema.parse(req.query);
      const retrospectiva = await retrospectivaService.gerar(usuarioId, query);
      return res.status(200).json(retrospectiva);
    } catch (err) {
      next(err);
    }
  },
};
