import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/summary', async (_req: Request, res: Response) => {
  const [
    appointmentsByStatus, opportunitiesByStatus,
    ticketsByStatus, ticketsByPriority,
    totalDoctors, totalSpecialties,
  ] = await Promise.all([
    prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.opportunity.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.specialty.count({ where: { isActive: true } }),
  ]);

  const toMap = (
    rows: { status?: string; priority?: string; _count: { _all: number } }[],
    key: 'status' | 'priority'
  ) => Object.fromEntries(rows.map((r) => [r[key], r._count._all]));

  res.json({
    appointments: {
      byStatus: toMap(appointmentsByStatus, 'status'),
      total: appointmentsByStatus.reduce((s, r) => s + r._count._all, 0),
    },
    opportunities: {
      byStatus: toMap(opportunitiesByStatus, 'status'),
      total: opportunitiesByStatus.reduce((s, r) => s + r._count._all, 0),
    },
    tickets: {
      byStatus: toMap(ticketsByStatus, 'status'),
      byPriority: toMap(ticketsByPriority, 'priority'),
      total: ticketsByStatus.reduce((s, r) => s + r._count._all, 0),
    },
    doctors: { total: totalDoctors },
    specialties: { total: totalSpecialties },
  });
});

export default router;
