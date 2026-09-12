import { NextFunction, Request, Response } from "express";
import { usuarioAutenticado } from "../../shared/middlewares/auth";
import { leituraService } from "./leitura.service";
import {
  atualizarLivroSchema,
  atualizarRegistroSchema,
  criarLivroSchema,
  criarRegistroSchema,
  estatisticasQuerySchema,
  listarLivrosQuerySchema,
} from "./leitura.schema";

export const leituraController = {
  // --------------------------------------------------------------------------
  // Livros
  // --------------------------------------------------------------------------

  async listarLivros(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const filtros = listarLivrosQuerySchema.parse(req.query);
      const livros = await leituraService.listarLivros(usuarioId, filtros);
      return res.status(200).json(livros);
    } catch (err) {
      next(err);
    }
  },

  async obterLivro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const livro = await leituraService.obterLivro(req.params.id as string, usuarioId);
      return res.status(200).json(livro);
    } catch (err) {
      next(err);
    }
  },

  async criarLivro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = criarLivroSchema.parse(req.body);
      const livro = await leituraService.criarLivro(usuarioId, dados);
      return res.status(201).json(livro);
    } catch (err) {
      next(err);
    }
  },

  async atualizarLivro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = atualizarLivroSchema.parse(req.body);
      const livro = await leituraService.atualizarLivro(
        req.params.id as string,
        usuarioId,
        dados,
      );
      return res.status(200).json(livro);
    } catch (err) {
      next(err);
    }
  },

  async deletarLivro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      await leituraService.deletarLivro(req.params.id as string, usuarioId);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // --------------------------------------------------------------------------
  // Registros de leitura
  // --------------------------------------------------------------------------

  async listarRegistros(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const registros = await leituraService.listarRegistros(
        req.params.id as string,
        usuarioId,
      );
      return res.status(200).json(registros);
    } catch (err) {
      next(err);
    }
  },

  async criarRegistro(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = criarRegistroSchema.parse(req.body);
      const registro = await leituraService.criarRegistro(
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
      const dados = atualizarRegistroSchema.parse(req.body);
      const registro = await leituraService.atualizarRegistro(
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
      await leituraService.deletarRegistro(req.params.id as string, usuarioId);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // --------------------------------------------------------------------------
  // Estatísticas
  // --------------------------------------------------------------------------

  async estatisticas(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const periodo = estatisticasQuerySchema.parse(req.query);
      const estatisticas = await leituraService.estatisticas(usuarioId, periodo);
      return res.status(200).json(estatisticas);
    } catch (err) {
      next(err);
    }
  },
};
