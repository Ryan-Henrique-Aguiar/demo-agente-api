import express from "express";
import cors from "cors";

import specialtiesRouter from './routes/specialties';
import doctorsRouter from './routes/doctors';
import appointmentsRouter from "./routes/appointments";
import opportunitiesRouter from "./routes/opportunities";
import ticketsRouter from "./routes/tickets";
import dashboardRouter from "./routes/dashboard";

export function createApp() {
  const app = express();

  const corsOrigins = (process.env.CORS_ORIGIN ?? "*")
    .split(",")
    .map((origin) => origin.trim());

  app.use(cors({
  origin: corsOrigins,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"]
}));
  app.use(express.json());

  // Healthcheck simples — útil para verificar se a API está no ar.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "leucotron-demo-backend" });
  });

  app.use('/api/specialties',   specialtiesRouter);
  app.use('/api/doctors',       doctorsRouter);
  app.use('/api/appointments',  appointmentsRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api/tickets',       ticketsRouter);
  app.use('/api/dashboard',     dashboardRouter);

  // Handler de rota não encontrada.
  app.use((req, res) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  });

  return app;
}
