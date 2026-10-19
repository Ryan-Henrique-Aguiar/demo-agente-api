-- Consultas médicas passam a aceitar confirmação explícita.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CONFIRMADO';

-- Exames usam apenas confirmação e cancelamento. Registros anteriores que
-- ainda não estavam cancelados passam a CONFIRMADO.
CREATE TYPE "ExamAppointmentStatus" AS ENUM ('CONFIRMADO', 'CANCELADO');
DROP INDEX "exam_appointments_active_slot_key";
ALTER TABLE "exam_appointments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "exam_appointments" ALTER COLUMN "status" TYPE "ExamAppointmentStatus"
  USING (CASE WHEN "status"::text = 'CANCELADO' THEN 'CANCELADO' ELSE 'CONFIRMADO' END)::"ExamAppointmentStatus";
ALTER TABLE "exam_appointments" ALTER COLUMN "status" SET DEFAULT 'CONFIRMADO';
CREATE UNIQUE INDEX "exam_appointments_active_slot_key"
  ON "exam_appointments"("examTypeId", "appointmentDate", "startTime")
  WHERE "status" = 'CONFIRMADO';
