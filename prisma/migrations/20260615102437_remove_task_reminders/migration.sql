/*
  Warnings:

  - You are about to drop the `task_reminder` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "task_reminder" DROP CONSTRAINT "task_reminder_task_id_fkey";

-- DropTable
DROP TABLE "task_reminder";
