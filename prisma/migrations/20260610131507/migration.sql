-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReminderIntervalType" ADD VALUE 'fixed';
ALTER TYPE "ReminderIntervalType" ADD VALUE 'custom';

-- AlterTable
ALTER TABLE "user_formula_weights" ADD COLUMN     "w_confidence" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
ALTER COLUMN "w_ease" SET DEFAULT 2.0;

-- CreateTable
CREATE TABLE "study_session_reminder" (
    "reminder_id" SERIAL NOT NULL,
    "study_session_id" INTEGER NOT NULL,
    "interval_type" "ReminderIntervalType" NOT NULL,
    "interval_value" INTEGER,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reminder_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_session_reminder_pkey" PRIMARY KEY ("reminder_id")
);

-- AddForeignKey
ALTER TABLE "study_session_reminder" ADD CONSTRAINT "study_session_reminder_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_session"("study_session_id") ON DELETE RESTRICT ON UPDATE CASCADE;
