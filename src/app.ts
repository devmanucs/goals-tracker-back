// Primeiro import de propósito: valida o ambiente antes de qualquer módulo
// que dependa dele ser avaliado.
import "./shared/config/env";
import cors from "cors";
import express, { Express } from "express";
import { authRoutes } from "./features/auth/auth.routes";
import { dashboardRoutes } from "./features/dashboard/dashboard.routes";
import {
  concursosRoutes,
  estudosRoutes,
  topicosRoutes,
} from "./features/estudos/estudos.routes";
import {
  habitosRoutes,
  registrosHabitoRoutes,
} from "./features/habitos/habitos.routes";
import {
  leituraRoutes,
  livrosRoutes,
  registrosLeituraRoutes,
} from "./features/leitura/leitura.routes";
import { retrospectivaRoutes } from "./features/retrospectiva/retrospectiva.routes";
import { errorHandler } from "./shared/middlewares/errorHandler";

export const app: Express = express();

app.use(cors());
app.use(express.json());

// Healthcheck — não exige autenticação.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Público
app.use("/auth", authRoutes);

// Autenticados (o authMiddleware é aplicado dentro de cada router)
app.use("/livros", livrosRoutes);
app.use("/registros-leitura", registrosLeituraRoutes);
app.use("/leitura", leituraRoutes);

app.use("/concursos", concursosRoutes);
app.use("/topicos", topicosRoutes);
app.use("/estudos", estudosRoutes);

app.use("/habitos", habitosRoutes);
app.use("/registros-habito", registrosHabitoRoutes);

app.use("/dashboard", dashboardRoutes);
app.use("/retrospectiva", retrospectivaRoutes);

// Precisa ser o último middleware registrado.
app.use(errorHandler);
