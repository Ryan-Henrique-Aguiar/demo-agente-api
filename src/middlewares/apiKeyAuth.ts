import { Request, Response, NextFunction } from "express";

/**
 * Middleware simples de autenticação por API key.
 *
 * O agente de IA (ou a automação que faz a ponte com o WhatsApp) deve enviar
 * a chave configurada em API_KEY no header "x-api-key" em toda requisição
 * de escrita (POST/PATCH).
 *
 * Por ser um ambiente de demonstração, mantemos a checagem simples
 * (comparação direta de string), sem JWT ou OAuth.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    // Falha de configuração do servidor — não deveria acontecer em produção.
    console.error("API_KEY não configurada no .env do servidor.");
    return res.status(500).json({ error: "Configuração do servidor incompleta." });
  }

  const providedKey = req.header("x-api-key");

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: "API key inválida ou ausente." });
  }

  return next();
}
