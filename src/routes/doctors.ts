import { Router, Request, Response } from 'express';
import { Weekday } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { validateRequiredFields } from '../utils/validation';
import {
  generateSlots, getWeekday, addDays,
  formatDateLocal, SLOT_DURATION_MINUTES,
} from '../utils/availability';

const router = Router();
const VALID_WEEKDAYS = Object.values(Weekday);

// ── CRUD médicos ──────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const { specialtyId, isActive } = req.query as Record<string, string>;
  const doctors = await prisma.doctor.findMany({
    where: {
      ...(specialtyId && { specialtyId }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    },
    include: { specialty: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(doctors);
});


router.get('/:id', async (req: Request, res: Response) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: req.params.id as string},
    include: {
      specialty: { select: { id: true, name: true } },
      schedules: { where: { isActive: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
    },
  });
  if (!doctor) { res.status(404).json({ error: 'Médico não encontrado.' }); return; }
  res.json(doctor);
});

// POST /api/doctors/availability — consulta disponibilidade por body
router.post('/availability', async (req: Request, res: Response) => {
  const { doctorId, from, days } = req.body as {
    doctorId?: string;
    from?: string;
    days?: number | string;
  };

  if (!doctorId) {
    res.status(400).json({ error: 'doctorId é obrigatório.' });
    return;
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      specialty: { select: { id: true, name: true } },
      schedules: { where: { isActive: true } },
    },
  });

  if (!doctor || !doctor.isActive) {
    res.status(404).json({ error: 'Médico não encontrado ou inativo.' });
    return;
  }

  const todayStr = formatDateLocal(new Date());
  const fromStr = String(from || todayStr).slice(0, 10);
  const daysNumber = Math.min(Math.max(parseInt(String(days || '7'), 10), 1), 30);

  const dates: string[] = [];
  for (let i = 0; i < daysNumber; i++) dates.push(addDays(fromStr, i));

  const lastDate = dates[dates.length - 1];

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: { gte: fromStr, lte: lastDate },
      status: { in: ['ABERTO', 'EM_ANDAMENTO'] },
    },
    select: { appointmentDate: true, startTime: true },
  });

  const occupied: Record<string, Set<string>> = {};

  for (const appt of existingAppointments) {
    if (!occupied[appt.appointmentDate]) occupied[appt.appointmentDate] = new Set();
    occupied[appt.appointmentDate].add(appt.startTime);
  }

  const availability = [];

  for (const dateStr of dates) {
    if (dateStr < todayStr) continue;

    const weekday = getWeekday(dateStr);
    const daySchedules = doctor.schedules.filter((s) => s.weekday === weekday);

    if (daySchedules.length === 0) continue;

    const occupiedSlots = occupied[dateStr] || new Set<string>();
    const available: string[] = [];

    for (const sched of daySchedules) {
      for (const slot of generateSlots(sched.startTime, sched.endTime)) {
        if (!occupiedSlots.has(slot)) available.push(slot);
      }
    }

    const unique = [...new Set(available)].sort();

    if (unique.length > 0) {
      availability.push({
        date: dateStr,
        weekday,
        slots: unique,
      });
    }
  }

  res.json({
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    slotDurationMinutes: SLOT_DURATION_MINUTES,
    from: fromStr,
    days: daysNumber,
    availability,
  });
});

router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const err = validateRequiredFields(req.body, ['name', 'specialtyId']);
  if (err) { res.status(400).json({ error: err }); return; }
  const { name, crm, specialtyId } = req.body as { name: string; crm?: string; specialtyId: string };
  const specialty = await prisma.specialty.findUnique({ where: { id: specialtyId } });
  if (!specialty) { res.status(404).json({ error: 'Especialidade não encontrada.' }); return; }
  if (crm) {
    const dup = await prisma.doctor.findUnique({ where: { crm } });
    if (dup) { res.status(409).json({ error: 'Já existe um médico com esse CRM.' }); return; }
  }
  const doctor = await prisma.doctor.create({
    data: { name, crm, specialtyId },
    include: { specialty: { select: { id: true, name: true } } },
  });
  res.status(201).json(doctor);
});

router.patch('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const { name, crm, specialtyId, isActive } = req.body as {
    name?: string; crm?: string; specialtyId?: string; isActive?: boolean;
  };
  const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id as string} });
  if (!doctor) { res.status(404).json({ error: 'Médico não encontrado.' }); return; }
  if (specialtyId) {
    const sp = await prisma.specialty.findUnique({ where: { id: specialtyId } });
    if (!sp) { res.status(404).json({ error: 'Especialidade não encontrada.' }); return; }
  }
  const updated = await prisma.doctor.update({
    where: { id: req.params.id as string},
    data: {
      ...(name !== undefined && { name }),
      ...(crm !== undefined && { crm }),
      ...(specialtyId !== undefined && { specialtyId }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { specialty: { select: { id: true, name: true } } },
  });
  res.json(updated);
});

router.delete('/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id as string} });
  if (!doctor) { res.status(404).json({ error: 'Médico não encontrado.' }); return; }
  await prisma.doctor.update({ where: { id: req.params.id as string}, data: { isActive: false } });
  res.status(204).send();
});

// ── Grade semanal ─────────────────────────────────────────────────────────────

router.get('/:id/schedules', async (req: Request, res: Response) => {
  const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id as string} });
  if (!doctor) { res.status(404).json({ error: 'Médico não encontrado.' }); return; }
  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId: req.params.id as string, isActive: true },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
  });
  res.json(schedules);
});

router.post('/:id/schedules', apiKeyAuth, async (req: Request, res: Response) => {
  const err = validateRequiredFields(req.body, ['weekday', 'startTime', 'endTime']);
  if (err) { res.status(400).json({ error: err }); return; }
  const { weekday, startTime, endTime } = req.body as { weekday: Weekday; startTime: string; endTime: string };
  if (!VALID_WEEKDAYS.includes(weekday)) {
    res.status(400).json({ error: `Dia inválido. Use: ${VALID_WEEKDAYS.join(', ')}` }); return;
  }
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    res.status(400).json({ error: 'Formato de horário inválido. Use HH:MM.' }); return;
  }
  if (startTime >= endTime) { res.status(400).json({ error: 'startTime deve ser anterior a endTime.' }); return; }
  const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id as string} });
  if (!doctor) { res.status(404).json({ error: 'Médico não encontrado.' }); return; }
  const schedule = await prisma.doctorSchedule.create({
    data: { doctorId: req.params.id as string, weekday, startTime, endTime},
  });
  res.status(201).json(schedule);
});

router.patch('/:id/schedules/:scheduleId', apiKeyAuth, async (req: Request, res: Response) => {
  const { weekday, startTime, endTime, isActive } = req.body as {
    weekday?: Weekday; startTime?: string; endTime?: string; isActive?: boolean;
  };
  const schedule = await prisma.doctorSchedule.findFirst({
    where: { id: req.params.scheduleId as string, doctorId: req.params.id as string},
  });
  if (!schedule) { res.status(404).json({ error: 'Grade não encontrada.' }); return; }
  const updated = await prisma.doctorSchedule.update({
    where: { id: req.params.scheduleId as string},
    data: {
      ...(weekday !== undefined && { weekday }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  res.json(updated);
});

router.delete('/:id/schedules/:scheduleId', apiKeyAuth, async (req: Request, res: Response) => {
  const schedule = await prisma.doctorSchedule.findFirst({
    where: { id: req.params.scheduleId as string, doctorId: req.params.id as string},
  });
  if (!schedule) { res.status(404).json({ error: 'Grade não encontrada.' }); return; }
  await prisma.doctorSchedule.delete({ where: { id: req.params.scheduleId as string} });
  res.status(204).send();
});

// ── Disponibilidade ───────────────────────────────────────────────────────────

// GET /api/doctors/:id/availability?from=YYYY-MM-DD&days=7
router.get('/:id/availability', async (req: Request, res: Response) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: req.params.id as string},
    include: {
      specialty: { select: { id: true, name: true } },
      schedules: { where: { isActive: true } },
    },
  });
  if (!doctor || !doctor.isActive) {
    res.status(404).json({ error: 'Médico não encontrado ou inativo.' }); return;
  }

  const todayStr = formatDateLocal(new Date());
  const fromStr = (req.query.from as string) || todayStr;
  const days = Math.min(Math.max(parseInt((req.query.days as string) || '7', 10), 1), 30);

  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(addDays(fromStr, i));

  const lastDate = dates[dates.length - 1];
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: req.params.id as string,
      appointmentDate: { gte: fromStr, lte: lastDate },
      status: { in: ['ABERTO', 'EM_ANDAMENTO'] },
    },
    select: { appointmentDate: true, startTime: true },
  });

  const occupied: Record<string, Set<string>> = {};
  for (const appt of existingAppointments) {
    if (!occupied[appt.appointmentDate]) occupied[appt.appointmentDate] = new Set();
    occupied[appt.appointmentDate].add(appt.startTime);
  }

  const availability = [];
  for (const dateStr of dates) {
    if (dateStr < todayStr) continue;
    const weekday = getWeekday(dateStr);
    const daySchedules = doctor?.schedules?.filter((s) => s.weekday === weekday);
    if (daySchedules.length === 0) continue;

    const occupiedSlots = occupied[dateStr] || new Set<string>();
    const available: string[] = [];
    for (const sched of daySchedules) {
      for (const slot of generateSlots(sched.startTime, sched.endTime)) {
        if (!occupiedSlots.has(slot)) available.push(slot);
      }
    }
    const unique = [...new Set(available)].sort();
    if (unique.length > 0) availability.push({ date: dateStr, weekday, slots: unique });
  }

  res.json({
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor?.specialty,
    slotDurationMinutes: SLOT_DURATION_MINUTES,
    from: fromStr,
    days,
    availability,
  });
});

export default router;
