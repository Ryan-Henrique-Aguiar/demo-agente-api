import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { generateCode } from "../utils/generateCode";
import { validateRequiredFields } from "../utils/validation";
import { apiKeyAuth } from "../middlewares/apiKeyAuth";
import { FlowStatus, TicketPriority, RequesterType } from "@prisma/client";

const router = Router();

/**
 * POST /api/tickets
 *
 * Endpoint chamado pelo agente de IA ao final do fluxo de Suporte
 * (abertura de chamado).
 *
 * Body esperado:
 * {
 *   "name": "João Silva",
 *   "company": "Alfa Energia",
 *   "email": "joao@email.com",
 *   "phone": "(35) 99999-9999",
 *   "requesterType": "CLIENTE",
 *   "product": "PABX em nuvem",
 *   "problem": "ramais sem completar chamadas externas",
 *   "priority": "MEDIA"   // opcional — se omitido, é inferida automaticamente
 * }
 */
router.post("/", apiKeyAuth, async (req: Request, res: Response) => {
  const requiredFields = ["name", "problem"];
  const missing = validateRequiredFields(req.body, requiredFields);

  if (missing.length > 0) {
    return res.status(400).json({
      error: "Campos obrigatórios faltando.",
      missingFields: missing,
    });
  }

  const {
    name,
    company,
    email,
    phone,
    requesterType,
    product,
    problem,
    priority,
  } = req.body;

  const validRequesterTypes = Object.values(RequesterType);
  if (requesterType && !validRequesterTypes.includes(requesterType)) {
    return res.status(400).json({
      error: "Tipo de solicitante inválido.",
      validRequesterTypes,
    });
  }

  const validPriorities = Object.values(TicketPriority);
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({
      error: "Prioridade inválida.",
      validPriorities,
    });
  }

  try {
    const code = await generateCode("SUP");
    const finalPriority: TicketPriority = priority ?? inferPriority(problem);

    const ticket = await prisma.ticket.create({
      data: {
        code,
        name,
        company: company ?? null,
        email: email ?? null,
        phone: phone ?? null,
        requesterType: requesterType ?? RequesterType.CLIENTE,
        product: product ?? null,
        problem,
        priority: finalPriority,
      },
    });

    return res.status(201).json(ticket);
  } catch (error) {
    console.error("Erro ao criar chamado:", error);
    return res.status(500).json({ error: "Erro interno ao registrar chamado." });
  }
});

/**
 * GET /api/tickets
 * Lista chamados, mais recentes primeiro. Filtros opcionais: ?status= e ?priority=
 */
router.get("/", async (req: Request, res: Response) => {
  const { status, priority } = req.query;

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        ...(status && { status: status as FlowStatus }),
        ...(priority && { priority: priority as TicketPriority }),
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(tickets);
  } catch (error) {
    console.error("Erro ao listar chamados:", error);
    return res.status(500).json({ error: "Erro interno ao listar chamados." });
  }
});

/**
 * GET /api/tickets/:id
 * Também aceita busca pelo código (ex: SUP-2045), útil para a etapa de
 * "consultar chamado" do fluxo de Suporte.
 */
router.get("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);

  try {
    const ticket = id.startsWith("SUP-")
      ? await prisma.ticket.findUnique({ where: { code: id } })
      : await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      return res.status(404).json({ error: "Chamado não encontrado." });
    }

    return res.json(ticket);
  } catch (error) {
    console.error("Erro ao buscar chamado:", error);
    return res.status(500).json({ error: "Erro interno ao buscar chamado." });
  }
});

/**
 * PATCH /api/tickets/:id
 * Atualiza status, prioridade e/ou notas (usado pelo vendedor/suporte no painel).
 */

interface TicketParams {
  id: string;
}

// Passamos o TicketParams como o primeiro genérico do Request
router.patch("/:id", async (req: Request<TicketParams>, res: Response) => {
  const { id } = req.params; // Agora o TS sabe 100% que 'id' é apenas string!
  const { status, priority, notes } = req.body;

  const validStatuses = Object.values(FlowStatus);
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Status inválido.", validStatuses });
  }

  const validPriorities = Object.values(TicketPriority);
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: "Prioridade inválida.", validPriorities });
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(notes !== undefined && { notes }),
      },
    });

    return res.json(ticket);
  } catch (error) {
    console.error("Erro ao atualizar chamado:", error);
    return res.status(404).json({ error: "Chamado não encontrado." });
  }
});

/**
 * DELETE /api/tickets/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  const id  = req.params.id as string;

  try {
    await prisma.ticket.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover chamado:", error);
    return res.status(404).json({ error: "Chamado não encontrado." });
  }
});

/**
 * Inferência simples de prioridade a partir de palavras-chave na descrição
 * do problema, para quando o agente de IA não enviar uma prioridade
 * explícita. É só uma heurística de demonstração, não uma regra de negócio real.
 */
function inferPriority(problem: string): TicketPriority {
  const text = problem.toLowerCase();

  const urgentKeywords = ["parou totalmente", "fora do ar", "urgente", "sistema todo"];
  const highKeywords = ["não completa", "sem completar", "queda", "instabilidade", "falha"];

  if (urgentKeywords.some((kw) => text.includes(kw))) {
    return TicketPriority.URGENTE;
  }

  if (highKeywords.some((kw) => text.includes(kw))) {
    return TicketPriority.ALTA;
  }

  return TicketPriority.MEDIA;
}

export default router;
