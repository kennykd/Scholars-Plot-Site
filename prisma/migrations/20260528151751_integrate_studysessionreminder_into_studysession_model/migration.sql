-- DropForeignKey
ALTER TABLE "study_session_reminder" DROP CONSTRAINT "study_session_reminder_study_session_id_fkey";

-- AlterTable
ALTER TABLE "study_session" ADD COLUMN     "study_session_remind_at_minutes" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "study_session_reminder_enabled" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "study_session_reminder";

/*
  Warnings:

  - The values [fixed,custom] on the enum `ReminderIntervalType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReminderIntervalType_new" AS ENUM ('minutes', 'hours', 'days', 'weeks', 'months');
ALTER TABLE "task_reminder" ALTER COLUMN "interval_type" TYPE "ReminderIntervalType_new" USING ("interval_type"::text::"ReminderIntervalType_new");
ALTER TYPE "ReminderIntervalType" RENAME TO "ReminderIntervalType_old";
ALTER TYPE "ReminderIntervalType_new" RENAME TO "ReminderIntervalType";
DROP TYPE "public"."ReminderIntervalType_old";
COMMIT;
