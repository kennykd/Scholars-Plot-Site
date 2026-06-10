/*
  Warnings:

  - You are about to drop the `alert` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "alert" DROP CONSTRAINT "alert_study_session_reminder_id_fkey";

-- DropForeignKey
ALTER TABLE "alert" DROP CONSTRAINT "alert_task_reminder_id_fkey";

-- DropTable
DROP TABLE "alert";

-- DropEnum
DROP TYPE "AlertType";
