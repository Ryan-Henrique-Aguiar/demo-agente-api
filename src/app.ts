import express from "express";
import cors from "cors";

import specialtiesRouter from './routes/specialties';
import doctorsRouter from './routes/doctors';
import appointmentsRouter from "./routes/appointments";
import opportunitiesRouter from "./routes/opportunities";
import ticketsRouter from "./routes/tickets";
import dashboardRouter from "./routes/dashboard";
import hotelsRouter from './routes/hotels';
import hotelReservationsRouter from './routes/hotelReservations';

export function createApp() {
  const app = express();

  // Trata e limpa as origens vindas do .env (remove barras no final)
  const rawOrigins = process.env.CORS_ORIGIN ?? "*";
  const corsOrigins = rawOrigins === "*" 
    ? "*" 
    : rawOrigins.split(",").map((origin) => origin.trim().replace(/\/$/, ""));

  app.use(
    cors({
      origin: corsOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-api-key",
        "ngrok-skip-browser-warning" // <--- ADICIONADO (Resolve o erro do Ngrok)
      ],
      credentials: true,
    })
  );

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
  app.use('/api/hotels',        hotelsRouter);
  app.use('/api/hotel-reservations', hotelReservationsRouter);

  // Handler de rota não encontrada.
  app.use((req, res) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  });

  return app;
}
