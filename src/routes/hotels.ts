import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { validateRequiredFields } from '../utils/validation';
import { generateCode } from '../utils/generateCode';

const router = Router();
const hotelInclude = { rooms: { orderBy: { name: 'asc' as const } } };

router.get('/', async (_req: Request, res: Response) => {
  res.json(await prisma.hotel.findMany({ include: hotelInclude, orderBy: { name: 'asc' } }));
});

router.get('/:id', async (req: Request, res: Response) => {
  const hotel = await prisma.hotel.findUnique({
  where: { id: req.params.id as string },
  include: hotelInclude,
});
  if (!hotel) { res.status(404).json({ error: 'Unidade de hotel não encontrada.' }); return; }
  res.json(hotel);
});

router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const err = validateRequiredFields(req.body, ['name', 'city', 'state']);
  if (err) { res.status(400).json({ error: err }); return; }
  const { name, city, state } = req.body as { name: string; city: string; state: string };
  const code = await generateCode('HO');
  const hotel = await prisma.hotel.create({ data: { code, name, city, state } });
  res.status(201).json(hotel);
});

router.post('/:hotelId/rooms', apiKeyAuth, async (req: Request, res: Response) => {
  const err = validateRequiredFields(req.body, ['name', 'description', 'price']);
  if (err) { res.status(400).json({ error: err }); return; }
  const hotel = await prisma.hotel.findUnique({
  where: { id: req.params.hotelId as string },
    });
  if (!hotel) { res.status(404).json({ error: 'Unidade de hotel não encontrada.' }); return; }
  const { name, description, price } = req.body as { name: string; description: string; price: number };
  if (!Number.isFinite(Number(price)) || Number(price) < 0) { res.status(400).json({ error: 'price deve ser um número maior ou igual a zero.' }); return; }
  res.status(201).json(await prisma.hotelRoom.create({ data: { hotelId: hotel.id, name, description, price: Number(price) } }));
});

router.patch('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const hotel = await prisma.hotel.findUnique({
  where: { id: req.params.id as string },
});
  if (!hotel) { res.status(404).json({ error: 'Unidade de hotel não encontrada.' }); return; }
  const { name, city, state } = req.body as { name?: string; city?: string; state?: string };
  res.json(await prisma.hotel.update({ where: { id: hotel.id }, data: { name, city, state } }));
});

export default router;