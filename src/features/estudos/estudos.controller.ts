import { NextFunction, Request, Response } from "express";
import { usuarioAutenticado } from "../../shared/middlewares/auth";
import { estudosService } from "./estudos.service";
import {
  atualizarConcursoSchema,
  atualizarTopicoSchema,
  calendarioQuerySchema,
  criarConcursoSchema,
  criarTopicoSchema,
  listarTopicosQuerySchema,
} from "./estudos.schema";

export const estudosController = {
  // --------------------------------------------------------------------------
  // Concursos
  // --------------------------------------------------------------------------

  async listarConcursos(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const concursos = await estudosService.listarConcursos(usuarioId);
      return res.status(200).json(concursos);
    } catch (err) {
      next(err);
    }
  },

  async obterConcurso(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const concurso = await estudosService.obterConcurso(
        req.params.id as string,
        usuarioId,
      );
      return res.status(200).json(concurso);
    } catch (err) {
      next(err);
    }
  },

  async criarConcurso(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = criarConcursoSchema.parse(req.body);
      const concurso = await estudosService.criarConcurso(usuarioId, dados);
      return res.status(201).json(concurso);
    } catch (err) {
      next(err);
    }
  },

  async atualizarConcurso(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = atualizarConcursoSchema.parse(req.body);
      const concurso = await estudosService.atualizarConcurso(
        req.params.id as string,
        usuarioId,
        dados,
      );
      return res.status(200).json(concurso);
    } catch (err) {
      next(err);
    }
  },

  async deletarConcurso(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      await estudosService.deletarConcurso(req.params.id as string, usuarioId);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // --------------------------------------------------------------------------
  // Tópicos
  // --------------------------------------------------------------------------

  async listarTopicos(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const filtros = listarTopicosQuerySchema.parse(req.query);
      const topicos = await estudosService.listarTopicos(
        req.params.id as string,
        usuarioId,
        filtros,
      );
      return res.status(200).json(topicos);
    } catch (err) {
      next(err);
    }
  },

  async criarTopico(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = criarTopicoSchema.parse(req.body);
      const topico = await estudosService.criarTopico(
        req.params.id as string,
        usuarioId,
        dados,
      );
      return res.status(201).json(topico);
    } catch (err) {
      next(err);
    }
  },

  async obterTopico(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const topico = await estudosService.obterTopico(
        req.params.id as string,
        usuarioId,
      );
      return res.status(200).json(topico);
    } catch (err) {
      next(err);
    }
  },

  async atualizarTopico(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const dados = atualizarTopicoSchema.parse(req.body);
      const topico = await estudosService.atualizarTopico(
        req.params.id as string,
        usuarioId,
        dados,
      );
      return res.status(200).json(topico);
    } catch (err) {
      next(err);
    }
  },

  async deletarTopico(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      await estudosService.deletarTopico(req.params.id as string, usuarioId);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // --------------------------------------------------------------------------
  // Derivados
  // --------------------------------------------------------------------------

  async calendarioDoConcurso(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const janela = calendarioQuerySchema.parse(req.query);
      const calendario = await estudosService.calendarioDoConcurso(
        req.params.id as string,
        usuarioId,
        janela,
      );
      return res.status(200).json(calendario);
    } catch (err) {
      next(err);
    }
  },

  async calendarioGeral(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const janela = calendarioQuerySchema.parse(req.query);
      const calendario = await estudosService.calendarioGeral(usuarioId, janela);
      return res.status(200).json(calendario);
    } catch (err) {
      next(err);
    }
  },

  async progresso(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const progresso = await estudosService.progressoDoConcurso(
        req.params.id as string,
        usuarioId,
      );
      return res.status(200).json(progresso);
    } catch (err) {
      next(err);
    }
  },

  async diasAteProva(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const resultado = await estudosService.diasAteProva(
        req.params.id as string,
        usuarioId,
      );
      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async proximoTopico(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = usuarioAutenticado(req);
      const topico = await estudosService.proximoTopico(usuarioId);
      return res.status(200).json(topico);
    } catch (err) {
      next(err);
    }
  },
};
