/*
  Warnings:

  - The `status` column on the `opportunities` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `tickets` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "FlowStatus" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "opportunities" DROP COLUMN "status",
ADD COLUMN     "status" "FlowStatus" NOT NULL DEFAULT 'ABERTO';

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "status",
ADD COLUMN     "status" "FlowStatus" NOT NULL DEFAULT 'ABERTO';

-- CreateTable
CREATE TABLE "code_sequences" (
    "id" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 1001,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_status_priority_idx" ON "tickets"("status", "priority");
