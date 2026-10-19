import { Router, Request, Response } from 'express';
import { ExamAppointmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { examSlots, getWeekday, minutesToTime, timeToMinutes, todayKey, validDate } from '../utils/exams';

const router = Router();
const statuses = Object.values(ExamAppointmentStatus);
const include = { examType: { select: { id: true, name: true, durationMinutes: true, preparation: true } } };

router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const { examTypeId, patientName, email, phone, appointmentDate, startTime } = req.body ?? {};
  if (typeof examTypeId !== 'string' || !examTypeId || typeof patientName !== 'string' || !patientName.trim() || !validDate(appointmentDate) || typeof startTime !== 'string') {
    res.status(400).json({ error: 'Informe exame, paciente, data YYYY-MM-DD e horário.' }); return;
  }
  if (email !== undefined && email !== null && (typeof email !== 'string' || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))) {
    res.status(400).json({ error: 'E-mail inválido.' }); return;
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    res.status(400).json({ error: 'Telefone inválido.' }); return;
  }
  if (!email?.trim() && !phone?.trim()) {
    res.status(400).json({ error: 'Informe telefone ou e-mail para contato.' }); return;
  }
  const today = todayKey();
  if (appointmentDate < today) { res.status(400).json({ error: 'Não é possível agendar em uma data passada.' }); return; }
  if (appointmentDate === today) {
    const now = new Date();
    if (timeToMinutes(startTime) <= now.getHours() * 60 + now.getMinutes()) {
      res.status(400).json({ error: 'Escolha um horário futuro.' }); return;
    }
  }
  const exam = await prisma.examType.findUnique({ where: { id: examTypeId }, include: { schedules: true } });
  if (!exam || !exam.isActive) { res.status(404).json({ error: 'Tipo de exame não encontrado ou inativo.' }); return; }
  const weekday = getWeekday(appointmentDate);
  const validSlots = exam.schedules.filter((schedule) => schedule.weekday === weekday)
    .flatMap((schedule) => examSlots(schedule.startTime, schedule.endTime, exam.durationMinutes));
  if (!validSlots.includes(startTime)) { res.status(400).json({ error: 'Horário fora da grade disponível para este exame.' }); return; }
  const occupied = await prisma.examAppointment.findFirst({ where: { examTypeId, appointmentDate, startTime, status: { not: 'CANCELADO' } } });
  if (occupied) { res.status(409).json({ error: 'Este horário já está ocupado.' }); return; }
  try {
    const sequence = await prisma.codeSequence.upsert({
      where: { id: 'EX' }, create: { id: 'EX', lastValue: 1001 }, update: { lastValue: { increment: 1 } },
    });
    const appointment = await prisma.examAppointment.create({
      data: {
        code: `EX-${sequence.lastValue}`, examTypeId, patientName: patientName.trim(),
        email: email?.trim() || null, phone: phone?.trim() || null,
        appointmentDate, startTime,
        endTime: minutesToTime(timeToMinutes(startTime) + exam.durationMinutes),
      },
      include,
    });
    res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'Este horário já está ocupado.' }); return;
    }
    throw error;
  }
});

router.get('/', async (req: Request, res: Response) => {
  const { examTypeId, date, status } = req.query as Record<string, string>;
  if (status && !statuses.includes(status as ExamAppointmentStatus)) { res.status(400).json({ error: 'Status inválido. Use CONFIRMADO ou CANCELADO.' }); return; }
  if (date && !validDate(date)) { res.status(400).json({ error: 'Data inválida.' }); return; }
  const items = await prisma.examAppointment.findMany({
    where: { ...(examTypeId && { examTypeId }), ...(date && { appointmentDate: date }), ...(status && { status: status as ExamAppointmentStatus }) },
    include,
    orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
  });
  res.json(items);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const item = await prisma.examAppointment.findUnique({ where: id.startsWith('EX-') ? { code: id } : { id }, include });
  if (!item) { res.status(404).json({ error: 'Agendamento de exame não encontrado.' }); return; }
  res.json(item);
});

router.patch('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const item = await prisma.examAppointment.findUnique({ where: id.startsWith('EX-') ? { code: id } : { id } });
  if (!item) { res.status(404).json({ error: 'Agendamento de exame não encontrado.' }); return; }
  const { status, notes } = req.body ?? {};
  if (status === undefined && notes === undefined) { res.status(400).json({ error: 'Informe status ou notas.' }); return; }
  if ((status !== undefined && !statuses.includes(status)) || (notes !== undefined && notes !== null && typeof notes !== 'string')) {
    res.status(400).json({ error: 'Status ou notas inválidos. Use CONFIRMADO ou CANCELADO.' }); return;
  }
  if (item.status === 'CANCELADO' && status !== undefined && status !== 'CANCELADO') {
    res.status(409).json({ error: 'Agendamento cancelado não pode ser reativado; crie outro.' }); return;
  }
  const updated = await prisma.examAppointment.update({
    where: { id: item.id },
    data: { ...(status !== undefined && { status }), ...(notes !== undefined && { notes }) },
    include,
  });
  res.json(updated);
});

export default router;
