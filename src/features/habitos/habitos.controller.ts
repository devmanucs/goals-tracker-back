import { NextFunction, Request, Response } from "express";
import { usuarioAutenticado } from "../../shared/middlewares/auth";
import { habitosService } from "./habitos.service";
import {
  atualizarHabitoSchema,
  atualizarRegistroHabitoSchema,
  criarHabitoSchema,
  criarRegistroHabitoSchema,
  listarRegistrosQuerySchema,
} from "./habitos.schema";

export const habitosController = {
  // --------------------------------------------------------------------------
  // Hábitos
  // --------------------------------------------------------------------------

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const habitos = await habitosService.listarHabitos(usuarioId);
      return res.status(200).json(habitos);
    } catch (err) {
      next(err);
    }
  },

  async obter(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const habito = await habitosService.obterHabito(
        req.params.id as string,
        usuarioId,
      );
      return res.status(200).json(habito);
    } catch (err) {
      next(err);
    }
  },

  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = criarHabitoSchema.parse(req.body);
      const habito = await habitosService.criarHabito(usuarioId, dados);
      return res.status(201).json(habito);
    } catch (err) {
      next(err);
    }
  },

  async atualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = atualizarHabitoSchema.parse(req.body);
      const habito = await habitosService.atualizarHabito(
        req.params.id as string,
        usuarioId,
        dados,
      );
      return res.status(200).json(habito);
    } catch (err) {
      next(err);
    }
  },

  async deletar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      await habitosService.deletarHabito(req.params.id as string, usuarioId);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // --------------------------------------------------------------------------
  // Registros
  // --------------------------------------------------------------------------

  async listarRegistros(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const janela = listarRegistrosQuerySchema.parse(req.query);
      const registros = await habitosService.listarRegistros(
        req.params.id as string,
        usuarioId,
        janela,
      );
      return res.status(200).json(registros);
    } catch (err) {
      next(err);
    }
  },

  async criarRegistro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = criarRegistroHabitoSchema.parse(req.body);
      const registro = await habitosService.criarRegistro(
        req.params.id as string,
        usuarioId,
        dados,
      );
      return res.status(201).json(registro);
    } catch (err) {
      next(err);
    }
  },

  async atualizarRegistro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = atualizarRegistroHabitoSchema.parse(req.body);
      const registro = await habitosService.atualizarRegistro(
        req.params.id as string,
        usuarioId,
        dados,
      );
      return res.status(200).json(registro);
    } catch (err) {
      next(err);
    }
  },

  async deletarRegistro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      await habitosService.deletarRegistro(req.params.id as string, usuarioId);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // --------------------------------------------------------------------------
  // Derivados
  // --------------------------------------------------------------------------

  async progressoAtual(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const progresso = await habitosService.progressoAtual(
        req.params.id as string,
        usuarioId,
      );
      return res.status(200).json(progresso);
    } catch (err) {
      next(err);
    }
  },

  async streak(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const streak = await habitosService.streak(req.params.id as string, usuarioId);
      return res.status(200).json(streak);
    } catch (err) {
      next(err);
    }
  },
};
