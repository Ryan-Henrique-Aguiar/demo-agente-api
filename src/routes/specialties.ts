import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { validateRequiredFields } from '../utils/validation';

const router = Router();

// GET /api/specialties — lista especialidades ativas (público)
router.get('/', async (_req: Request, res: Response) => {
  const specialties = await prisma.specialty.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isActive: true, createdAt: true },
  });
  res.json(specialties);
});

// GET /api/specialties/:id — detalhe + médicos
router.get('/:id', async (req: Request, res: Response) => {
  const specialty = await prisma.specialty.findUnique({
    where: { id: req.params.id as string},
    include: { doctors: { where: { isActive: true }, select: { id: true, name: true, crm: true } } },
  });
  if (!specialty) { res.status(404).json({ error: 'Especialidade não encontrada.' }); return; }
  res.json(specialty);
});

// POST /api/specialties — cria (protegido)
router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const err = validateRequiredFields(req.body, ['name']);

  if (Array.isArray(err) && err.length > 0) {
    res.status(400).json({ error: err });
    return;
  }

  if (!Array.isArray(err) && err) {
    res.status(400).json({ error: err });
    return;
  }

  const { name } = req.body as { name: string };

  const existing = await prisma.specialty.findUnique({ where: { name } });
  if (existing) {
    res.status(409).json({ error: 'Já existe uma especialidade com esse nome.' });
    return;
  }

  const specialty = await prisma.specialty.create({
    data: {
      name,
      isActive: true
    }
  });

  res.status(201).json(specialty);
});

// PATCH /api/specialties/:id — atualiza (protegido)
router.patch('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };
  const specialty = await prisma.specialty.findUnique({ where: { id: req.params.id as string} });
  if (!specialty) { res.status(404).json({ error: 'Especialidade não encontrada.' }); return; }
  const updated = await prisma.specialty.update({
    where: { id: req.params.id as string},
    data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
  });
  res.json(updated);
});

// DELETE /api/specialties/:id — inativação lógica (protegido)
router.delete('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const specialty = await prisma.specialty.findUnique({ where: { id: req.params.id as string} });
  if (!specialty) { res.status(404).json({ error: 'Especialidade não encontrada.' }); return; }
  await prisma.specialty.update({ where: { id: req.params.id as string}, data: { isActive: false } });
  res.status(204).send();
});

export default router;
