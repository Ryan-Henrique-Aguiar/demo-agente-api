CREATE TABLE "exam_types" (
    "id" TEXT NOT NULL, "name" TEXT NOT NULL, "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "preparation" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_schedules" (
    "id" TEXT NOT NULL, "examTypeId" TEXT NOT NULL, "weekday" "Weekday" NOT NULL,
    "startTime" TEXT NOT NULL, "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_appointments" (
    "id" TEXT NOT NULL, "code" TEXT NOT NULL, "examTypeId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL, "email" TEXT, "phone" TEXT,
    "appointmentDate" TEXT NOT NULL, "startTime" TEXT NOT NULL, "endTime" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'ABERTO', "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_appointments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_types_name_key" ON "exam_types"("name");
CREATE INDEX "exam_schedules_examTypeId_weekday_idx" ON "exam_schedules"("examTypeId", "weekday");
CREATE UNIQUE INDEX "exam_appointments_code_key" ON "exam_appointments"("code");
CREATE UNIQUE INDEX "exam_appointments_active_slot_key" ON "exam_appointments"("examTypeId", "appointmentDate", "startTime") WHERE "status" <> 'CANCELADO';
CREATE INDEX "exam_appointments_examTypeId_appointmentDate_idx" ON "exam_appointments"("examTypeId", "appointmentDate");
CREATE INDEX "exam_appointments_status_idx" ON "exam_appointments"("status");

ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "exam_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_appointments" ADD CONSTRAINT "exam_appointments_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "exam_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
