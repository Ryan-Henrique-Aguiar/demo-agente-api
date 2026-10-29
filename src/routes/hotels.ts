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

router.patch('/:hotelId/rooms/:roomId', apiKeyAuth, async (req: Request, res: Response) => {
  const room = await prisma.hotelRoom.findFirst({
    where: { id: req.params.roomId as string, hotelId: req.params.hotelId as string },
  });
  if (!room) { res.status(404).json({ error: 'Quarto não encontrado nesta unidade.' }); return; }

  const { name, description, price, isActive } = req.body ?? {};
  if (name === undefined && description === undefined && price === undefined && isActive === undefined) {
    res.status(400).json({ error: 'Informe um campo para atualizar.' }); return;
  }
  const cleanName = typeof name === 'string' ? name.trim() : name;
  const cleanDescription = typeof description === 'string' ? description.trim() : description;
  if ((name !== undefined && (typeof cleanName !== 'string' || !cleanName)) ||
      (description !== undefined && (typeof cleanDescription !== 'string' || !cleanDescription)) ||
      (price !== undefined && (price === null || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0)) ||
      (isActive !== undefined && typeof isActive !== 'boolean')) {
    res.status(400).json({ error: 'Nome, descrição, preço ou status inválido.' }); return;
  }
  if (cleanName !== undefined && cleanName !== room.name) {
    const duplicate = await prisma.hotelRoom.findUnique({
      where: { hotelId_name: { hotelId: room.hotelId, name: cleanName } },
    });
    if (duplicate) { res.status(409).json({ error: 'Já existe um quarto com esse nome nesta unidade.' }); return; }
  }

  const updated = await prisma.hotelRoom.update({
    where: { id: room.id },
    data: {
      ...(cleanName !== undefined && { name: cleanName }),
      ...(cleanDescription !== undefined && { description: cleanDescription }),
      ...(price !== undefined && { price: Number(price) }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  res.json(updated);
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
