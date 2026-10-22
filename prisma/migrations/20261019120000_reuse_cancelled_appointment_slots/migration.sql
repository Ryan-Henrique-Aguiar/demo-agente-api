-- Histórico cancelado permanece no banco, mas não reserva mais o horário.
-- A restrição parcial mantém a proteção contra dois agendamentos não cancelados
-- para o mesmo médico, data e horário, inclusive em requisições simultâneas.
BEGIN;
DROP INDEX "appointments_doctorId_appointmentDate_startTime_key";
CREATE UNIQUE INDEX "appointments_active_slot_key"
  ON "appointments"("doctorId", "appointmentDate", "startTime")
  WHERE "status" <> 'CANCELADO';
COMMIT;
