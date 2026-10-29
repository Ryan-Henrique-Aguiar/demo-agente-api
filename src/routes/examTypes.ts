import { Router, Request, Response } from 'express';
import { Weekday } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { addDays, examSlots, getWeekday, timePattern, todayKey, validDate } from '../utils/exams';

const router = Router();
const weekdays = Object.values(Weekday);
const examInclude = { schedules: { orderBy: [{ weekday: 'asc' as const }, { startTime: 'asc' as const }] } };

router.get('/', async (req: Request, res: Response) => {
  const isActive = req.query.isActive;
  if (isActive !== undefined && isActive !== 'true' && isActive !== 'false') {
    res.status(400).json({ error: 'isActive deve ser true ou false.' }); return;
  }
  const items = await prisma.examType.findMany({
    where: isActive === undefined ? {} : { isActive: isActive === 'true' },
    include: examInclude,
    orderBy: { name: 'asc' },
  });
  res.json(items);
});

router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const { name, durationMinutes, preparation } = req.body ?? {};
  const duration = durationMinutes === undefined ? 15 : Number(durationMinutes);
  if (typeof name !== 'string' || !name.trim() || !Number.isInteger(duration) || duration < 5 || duration > 120 || duration % 5 !== 0 || (preparation !== undefined && preparation !== null && typeof preparation !== 'string')) {
    res.status(400).json({ error: 'Informe nome e duração de 5 a 120 minutos, em múltiplos de 5.' }); return;
  }
  const cleanName = name.trim();
  if (await prisma.examType.findUnique({ where: { name: cleanName } })) {
    res.status(409).json({ error: 'Já existe um tipo de exame com esse nome.' }); return;
  }
  const item = await prisma.examType.create({ data: { name: cleanName, durationMinutes: duration, preparation: preparation?.trim() || null } });
  res.status(201).json(item);
});

router.get('/:id/availability', async (req: Request, res: Response) => {
  const exam = await prisma.examType.findUnique({ where: { id: req.params.id as string }, include: examInclude });
  if (!exam || !exam.isActive) { res.status(404).json({ error: 'Tipo de exame não encontrado ou inativo.' }); return; }
  const from = req.query.from === undefined ? todayKey() : req.query.from;
  const days = req.query.days === undefined ? 7 : Number(req.query.days);
  if (!validDate(from) || !Number.isInteger(days) || days < 1 || days > 30) {
    res.status(400).json({ error: 'Use from=YYYY-MM-DD e days entre 1 e 30.' }); return;
  }
  const last = addDays(from, days - 1);
  const reservations = await prisma.examAppointment.findMany({
    where: { examTypeId: exam.id, appointmentDate: { gte: from, lte: last }, status: { not: 'CANCELADO' } },
    select: { appointmentDate: true, startTime: true },
  });
  const occupied = new Set(reservations.map((item) => `${item.appointmentDate}:${item.startTime}`));
  const today = todayKey();
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const availability = Array.from({ length: days }, (_, offset) => {
    const date = addDays(from, offset);
    const weekday = getWeekday(date);
    const slots = date < today ? [] : [...new Set(exam.schedules
      .filter((schedule) => schedule.weekday === weekday)
      .flatMap((schedule) => examSlots(schedule.startTime, schedule.endTime, exam.durationMinutes)))]
      .filter((slot) => !occupied.has(`${date}:${slot}`) && (date !== today || slot > currentTime))
      .sort();
    return { date, weekday, slots };
  }).filter((day) => day.slots.length > 0);
  res.json({ examTypeId: exam.id, examTypeName: exam.name, durationMinutes: exam.durationMinutes, preparation: exam.preparation, from, days, availability });
});

router.get('/:id', async (req: Request, res: Response) => {
  const item = await prisma.examType.findUnique({ where: { id: req.params.id as string }, include: examInclude });
  if (!item) { res.status(404).json({ error: 'Tipo de exame não encontrado.' }); return; }
  res.json(item);
});

router.patch('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const item = await prisma.examType.findUnique({ where: { id: req.params.id as string } });
  if (!item) { res.status(404).json({ error: 'Tipo de exame não encontrado.' }); return; }
  const { name, durationMinutes, preparation, isActive } = req.body ?? {};
  if (name === undefined && durationMinutes === undefined && preparation === undefined && isActive === undefined) { res.status(400).json({ error: 'Informe um campo para atualizar.' }); return; }
  const duration = durationMinutes === undefined ? undefined : Number(durationMinutes);
  if ((name !== undefined && (typeof name !== 'string' || !name.trim())) ||
      (durationMinutes !== undefined && (durationMinutes === null || durationMinutes === '' || duration === undefined || !Number.isInteger(duration) || duration < 5 || duration > 120 || duration % 5 !== 0)) ||
      (preparation !== undefined && preparation !== null && typeof preparation !== 'string') ||
      (isActive !== undefined && typeof isActive !== 'boolean')) {
    res.status(400).json({ error: 'Informe nome, preparo, status e duração válida de 5 a 120 minutos em múltiplos de 5.' }); return;
  }
  const cleanName = name?.trim();
  if (cleanName && cleanName !== item.name && await prisma.examType.findUnique({ where: { name: cleanName } })) {
    res.status(409).json({ error: 'Já existe um tipo de exame com esse nome.' }); return;
  }
  if (duration !== undefined && duration !== item.durationMinutes) {
    const futureAppointment = await prisma.examAppointment.findFirst({
      where: { examTypeId: item.id, appointmentDate: { gte: todayKey() }, status: { not: 'CANCELADO' } },
      select: { id: true },
    });
    if (futureAppointment) {
      res.status(409).json({ error: 'Não é possível alterar a duração enquanto houver agendamentos futuros para este exame.' }); return;
    }
  }
  const updated = await prisma.examType.update({
    where: { id: item.id },
    data: { ...(cleanName !== undefined && { name: cleanName }), ...(duration !== undefined && { durationMinutes: duration }), ...(preparation !== undefined && { preparation: preparation?.trim() || null }), ...(isActive !== undefined && { isActive }) },
    include: examInclude,
  });
  res.json(updated);
});

router.get('/:id/schedules', async (req: Request, res: Response) => {
  const item = await prisma.examType.findUnique({ where: { id: req.params.id as string }, include: examInclude });
  if (!item) { res.status(404).json({ error: 'Tipo de exame não encontrado.' }); return; }
  res.json(item.schedules);
});

router.post('/:id/schedules', apiKeyAuth, async (req: Request, res: Response) => {
  const { weekday, startTime, endTime } = req.body ?? {};
  if (!weekdays.includes(weekday) || !timePattern.test(startTime) || !timePattern.test(endTime) || startTime >= endTime) {
    res.status(400).json({ error: 'Informe dia da semana e intervalo HH:MM válido.' }); return;
  }
  const item = await prisma.examType.findUnique({ where: { id: req.params.id as string }, include: { schedules: true } });
  if (!item) { res.status(404).json({ error: 'Tipo de exame não encontrado.' }); return; }
  if (item.schedules.some((schedule) => schedule.weekday === weekday && startTime < schedule.endTime && endTime > schedule.startTime)) {
    res.status(409).json({ error: 'Esta faixa se sobrepõe a outra do mesmo exame.' }); return;
  }
  const schedule = await prisma.examSchedule.create({ data: { examTypeId: item.id, weekday, startTime, endTime } });
  res.status(201).json(schedule);
});

router.delete('/:id/schedules/:scheduleId', apiKeyAuth, async (req: Request, res: Response) => {
  const schedule = await prisma.examSchedule.findFirst({ where: { id: req.params.scheduleId as string, examTypeId: req.params.id as string } });
  if (!schedule) { res.status(404).json({ error: 'Faixa de exames não encontrada.' }); return; }
  await prisma.examSchedule.delete({ where: { id: schedule.id } });
  res.status(204).send();
});

export default router;
