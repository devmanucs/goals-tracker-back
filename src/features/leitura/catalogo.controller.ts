import { NextFunction, Request, Response } from "express";
import { usuarioAutenticado } from "../../shared/middlewares/auth";
import { buscarNoCatalogoSchema, detalharDoCatalogoSchema } from "./catalogo.schema";
import { catalogoService } from "./catalogo.service";

export const catalogoController = {
  async buscar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const query = buscarNoCatalogoSchema.parse(req.query);
      const resultado = await catalogoService.buscar(usuarioId, query);
      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async detalhar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const { chave } = detalharDoCatalogoSchema.parse(req.query);
      const detalhe = await catalogoService.detalhar(usuarioId, chave);
      return res.status(200).json(detalhe);
    } catch (err) {
      next(err);
    }
  },
};
