-- ABERTO e CONFIRMADO reservam o horário; somente CANCELADO o libera.
BEGIN;
DROP INDEX "exam_appointments_active_slot_key";
CREATE UNIQUE INDEX "exam_appointments_active_slot_key"
  ON "exam_appointments"("examTypeId", "appointmentDate", "startTime")
  WHERE "status" <> 'CANCELADO';
ALTER TABLE "exam_appointments" ALTER COLUMN "status" SET DEFAULT 'ABERTO';
COMMIT;
