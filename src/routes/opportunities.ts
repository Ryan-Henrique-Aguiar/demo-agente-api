import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { generateCode } from "../utils/generateCode";
import { validateRequiredFields } from "../utils/validation";
import { apiKeyAuth } from "../middlewares/apiKeyAuth";
import { FlowStatus } from "@prisma/client";

const router = Router();

/**
 * POST /api/opportunities
 *
 * Endpoint chamado pelo agente de IA ao final do fluxo Comercial, quando
 * o encaminhamento para um vendedor especialista é simulado.
 *
 * Body esperado:
 * {
 *   "contactName": "João Silva",
 *   "company": "Alfa Energia",
 *   "email": "joao@email.com",
 *   "phone": "(35) 99999-9999",
 *   "need": "PABX em nuvem e atendimento omnichannel",
 *   "hasPabx": true,
 *   "highVolume": true,
 *   "digitalChannels": "WhatsApp e telefone"
 * }
 */
router.post("/", apiKeyAuth, async (req: Request, res: Response) => {
  const requiredFields = ["contactName", "company", "email", "phone", "need"];
  const missing = validateRequiredFields(req.body, requiredFields);

  if (missing.length > 0) {
    return res.status(400).json({
      error: "Campos obrigatórios faltando.",
      missingFields: missing,
    });
  }

  const {
    contactName,
    company,
    email,
    phone,
    need,
    hasPabx,
    highVolume,
    digitalChannels,
  } = req.body;

  try {
    const code = await generateCode("CRM");

    const opportunity = await prisma.opportunity.create({
      data: {
        code,
        contactName,
        company,
        email,
        phone,
        need,
        hasPabx: Boolean(hasPabx),
        highVolume: Boolean(highVolume),
        digitalChannels: digitalChannels ?? null,
      },
    });

    return res.status(201).json(opportunity);
  } catch (error) {
    console.error("Erro ao criar oportunidade:", error);
    return res.status(500).json({ error: "Erro interno ao registrar oportunidade." });
  }
});

/**
 * GET /api/opportunities
 * Lista oportunidades, mais recentes primeiro. Filtro opcional: ?status=ABERTO
 */
router.get("/", async (req: Request, res: Response) => {
  const { status } = req.query;

  try {
    const opportunities = await prisma.opportunity.findMany({
      where: status ? { status: status as FlowStatus } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return res.json(opportunities);
  } catch (error) {
    console.error("Erro ao listar oportunidades:", error);
    return res.status(500).json({ error: "Erro interno ao listar oportunidades." });
  }
});

/**
 * GET /api/opportunities/:id
 */
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id } });

    if (!opportunity) {
      return res.status(404).json({ error: "Oportunidade não encontrada." });
    }

    return res.json(opportunity);
  } catch (error) {
    console.error("Erro ao buscar oportunidade:", error);
    return res.status(500).json({ error: "Erro interno ao buscar oportunidade." });
  }
});

/**
 * PATCH /api/opportunities/:id
 * Atualiza status e/ou notas (usado pelo vendedor no painel).
 */
router.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = Object.values(FlowStatus);
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      error: "Status inválido.",
      validStatuses,
    });
  }

  try {
    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
    });

    return res.json(opportunity);
  } catch (error) {
    console.error("Erro ao atualizar oportunidade:", error);
    return res.status(404).json({ error: "Oportunidade não encontrada." });
  }
});

/**
 * DELETE /api/opportunities/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.opportunity.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover oportunidade:", error);
    return res.status(404).json({ error: "Oportunidade não encontrada." });
  }
});

export default router;
