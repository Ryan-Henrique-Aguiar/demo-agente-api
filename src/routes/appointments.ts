import { Router, Request, Response } from 'express';
import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { apiKeyAuth } from '../middlewares/apiKeyAuth';
import { generateAppointmentCode } from '../utils/generateCode';
import { requireFields } from '../utils/validation';
import {
  generateSlots, getWeekday,
  minutesToTime, timeToMinutes, SLOT_DURATION_MINUTES,
} from '../utils/availability';

const router = Router();

// POST /api/appointments — cria agendamento (protegido)
router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const err = requireFields(req.body, ['patientName', 'specialtyId', 'doctorId', 'appointmentDate', 'startTime']);
  if (err) { res.status(400).json({ error: err }); return; }

  const { patientName, email, phone, specialtyId, doctorId, appointmentDate, startTime, reason } =
    req.body as {
      patientName: string; email?: string; phone?: string;
      specialtyId: string; doctorId: string;
      appointmentDate: string; startTime: string; reason?: string;
    };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    res.status(400).json({ error: 'appointmentDate deve estar no formato YYYY-MM-DD.' }); return;
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, mo, d] = appointmentDate.split('-').map(Number);
  if (new Date(y, mo - 1, d) < today) {
    res.status(400).json({ error: 'Não é possível agendar em uma data passada.' }); return;
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { schedules: { where: { isActive: true } } },
  });
  if (!doctor || !doctor.isActive) {
    res.status(404).json({ error: 'Médico não encontrado ou inativo.' }); return;
  }
  if (doctor.specialtyId !== specialtyId) {
    res.status(400).json({ error: 'O médico não pertence à especialidade informada.' }); return;
  }

  const weekday = getWeekday(appointmentDate);
  const daySchedules = doctor.schedules.filter((s) => s.weekday === weekday);
  if (daySchedules.length === 0) {
    res.status(400).json({ error: 'O médico não atende neste dia da semana.' }); return;
  }

  const allSlots: string[] = [];
  for (const sched of daySchedules) allSlots.push(...generateSlots(sched.startTime, sched.endTime));
  if (!allSlots.includes(startTime)) {
    res.status(400).json({ error: 'Horário inválido ou fora da grade do médico.' }); return;
  }

  const conflict = await prisma.appointment.findUnique({
    where: { doctorId_appointmentDate_startTime: { doctorId, appointmentDate, startTime } },
  });
  if (conflict && conflict.status !== AppointmentStatus.CANCELADO) {
    res.status(409).json({ error: 'Este horário já está ocupado.' }); return;
  }

  const endTime = minutesToTime(timeToMinutes(startTime) + SLOT_DURATION_MINUTES);
  const code = await generateAppointmentCode();

  const appointment = await prisma.appointment.create({
    data: { code, patientName, email, phone, specialtyId, doctorId, appointmentDate, startTime, endTime, reason },
    include: {
      specialty: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true, crm: true } },
    },
  });
  res.status(201).json(appointment);
});

// GET /api/appointments — lista agendamentos
router.get('/', async (req: Request, res: Response) => {
  const { status, doctorId, specialtyId, date } = req.query as Record<string, string>;
  const appointments = await prisma.appointment.findMany({
    where: {
      ...(status && { status: status as AppointmentStatus }),
      ...(doctorId && { doctorId }),
      ...(specialtyId && { specialtyId }),
      ...(date && { appointmentDate: date }),
    },
    include: {
      specialty: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true, crm: true } },
    },
    orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
  });
  res.json(appointments);
});

// GET /api/appointments/:id — detalhe por ID ou AGD-XXXX
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const where = id.startsWith('AGD-') ? { code: id } : { id };
  const appointment = await prisma.appointment.findUnique({
    where,
    include: {
      specialty: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true, crm: true } },
    },
  });
  if (!appointment) { res.status(404).json({ error: 'Agendamento não encontrado.' }); return; }
  res.json(appointment);
});

// PATCH /api/appointments/:id — atualiza status/notas
router.patch('/:id', async (req: Request, res: Response) => {
  const { status, notes } = req.body as { status?: AppointmentStatus; notes?: string };
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment) { res.status(404).json({ error: 'Agendamento não encontrado.' }); return; }
  const updated = await prisma.appointment.update({
    where: { id: req.params.id },
    data: { ...(status !== undefined && { status }), ...(notes !== undefined && { notes }) },
    include: {
      specialty: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true, crm: true } },
    },
  });
  res.json(updated);
});

export default router;
