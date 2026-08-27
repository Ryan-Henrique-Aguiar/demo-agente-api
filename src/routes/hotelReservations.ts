import { Router, Request, Response } from 'express';
import { HotelReservationStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { validateRequiredFields } from '../utils/validation';

const router = Router();
const reservationInclude = { hotel: true, room: true };

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function reservationCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function conflictWhere(checkIn: Date, checkOut: Date, roomId?: string, reservationId?: string): Prisma.HotelReservationWhereInput {
  return { ...(roomId && { roomId }), status: HotelReservationStatus.CONFIRMED, checkIn: { lt: checkOut }, checkOut: { gt: checkIn }, ...(reservationId && { NOT: { id: reservationId } }) };
}

router.post('/availability', async (req: Request, res: Response) => {
  const { hotelId, roomId, roomIds, checkIn: checkInValue, checkOut: checkOutValue } = req.body as { hotelId?: string; roomId?: string; roomIds?: string[]; checkIn?: string; checkOut?: string };
  const checkIn = parseDate(checkInValue); const checkOut = parseDate(checkOutValue);
  if (!hotelId || !checkIn || !checkOut || checkIn >= checkOut) { res.status(400).json({ error: 'Informe hotelId, checkIn e checkOut válidos; checkOut deve ser posterior a checkIn.' }); return; }
  const selectedIds = roomIds?.length ? roomIds : roomId ? [roomId] : undefined;
  const rooms = await prisma.hotelRoom.findMany({ where: { hotelId, isActive: true, ...(selectedIds && { id: { in: selectedIds } }) }, include: { reservations: { where: conflictWhere(checkIn, checkOut), select: { id: true } } }, orderBy: { name: 'asc' } });
  res.json({ hotelId, checkIn: checkInValue, checkOut: checkOutValue, rooms: rooms.map(({ reservations, ...room }) => ({ ...room, available: reservations.length === 0 })) });
});

router.get('/', async (req: Request, res: Response) => {
  const { hotelId, roomId, status, guestName } = req.query as Record<string, string>;
  res.json(await prisma.hotelReservation.findMany({ where: { ...(hotelId && { hotelId }), ...(roomId && { roomId }), ...(status && { status: status as HotelReservationStatus }), ...(guestName && { guestName: { contains: guestName, mode: 'insensitive' } }) }, include: reservationInclude, orderBy: { createdAt: 'desc' } }));
});

router.get('/:id', async (req: Request, res: Response) => {
  const targetId = req.params.id as string;
  const reservation = await prisma.hotelReservation.findFirst({
    where: { OR: [{ id: targetId }, { code: targetId }] },
    include: reservationInclude,
  });
  if (!reservation) {
    res.status(404).json({ error: 'Reserva de hotel não encontrada.' });
    return;
  }
  res.json(reservation);
});

router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const err = validateRequiredFields(req.body, ['hotelId', 'roomId', 'guestName', 'checkIn', 'checkOut']);
  if (err) { res.status(400).json({ error: err }); return; }
  const { hotelId, roomId, guestName, email, phone, checkIn: checkInValue, checkOut: checkOutValue } = req.body as Record<string, string>;
  const checkIn = parseDate(checkInValue); const checkOut = parseDate(checkOutValue);
  if (!checkIn || !checkOut || checkIn >= checkOut) { res.status(400).json({ error: 'checkIn e checkOut devem ser datas YYYY-MM-DD, com checkOut posterior.' }); return; }
  const room = await prisma.hotelRoom.findFirst({ where: { id: roomId, hotelId, isActive: true } });
  if (!room) { res.status(404).json({ error: 'Quarto não encontrado, inativo ou não pertence à unidade.' }); return; }
  if (await prisma.hotelReservation.findFirst({ where: conflictWhere(checkIn, checkOut, roomId) })) { res.status(409).json({ error: 'O quarto já está reservado para parte desse período.' }); return; }
  const pixCode = `000201HOTEL${reservationCode('PIX').replace(/-/g, '')}`;
  res.status(201).json(await prisma.hotelReservation.create({ data: { code: reservationCode('HRS'), hotelId, roomId, guestName, email, phone, checkIn, checkOut, pixCode, pixLink: `pix://pay?code=${encodeURIComponent(pixCode)}` }, include: reservationInclude }));
});

router.patch('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const targetId = req.params.id as string;
  const current = await prisma.hotelReservation.findFirst({
    where: { OR: [{ id: targetId }, { code: targetId }] },
  });
  if (!current) {
    res.status(404).json({ error: 'Reserva de hotel não encontrada.' });
    return;
  }
  const { status, roomId, checkIn: checkInValue, checkOut: checkOutValue } = req.body as { status?: HotelReservationStatus; roomId?: string; checkIn?: string; checkOut?: string };
  const checkIn = checkInValue ? parseDate(checkInValue) : current.checkIn;
  const checkOut = checkOutValue ? parseDate(checkOutValue) : current.checkOut;
  const targetRoomId = roomId || current.roomId;
  if (!checkIn || !checkOut || checkIn >= checkOut) {
    res.status(400).json({ error: 'Período inválido.' });
    return;
  }
  if (status && !Object.values(HotelReservationStatus).includes(status)) {
    res.status(400).json({ error: 'status inválido.' });
    return;
  }
  if (status !== HotelReservationStatus.CANCELLED && await prisma.hotelReservation.findFirst({ where: conflictWhere(checkIn, checkOut, targetRoomId, current.id) })) {
    res.status(409).json({ error: 'O quarto já está reservado para parte desse período.' });
    return;
  }
  res.json(await prisma.hotelReservation.update({ where: { id: current.id }, data: { ...(roomId && { roomId }), ...(status && { status }), checkIn, checkOut }, include: reservationInclude }));
});

export default router;