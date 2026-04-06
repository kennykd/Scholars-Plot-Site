/*
  Warnings:

  - You are about to drop the column `break_duration` on the `study_session` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `study_session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "study_session" DROP COLUMN "break_duration",
DROP COLUMN "duration",
ADD COLUMN     "break_minutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "focus_minutes" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "total_minutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "total_pomodoros" INTEGER NOT NULL DEFAULT 1;
