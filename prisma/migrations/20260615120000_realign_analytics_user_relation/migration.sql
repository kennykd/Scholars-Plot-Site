-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_analytics_id_fkey";

-- AlterTable
ALTER TABLE "analytics" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_completion_date" TIMESTAMP(3),
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "tasks_completed_early" DROP DEFAULT,
ALTER COLUMN "tasks_completed_early" SET DATA TYPE TEXT,
ALTER COLUMN "tasks_completed_on_time" DROP DEFAULT,
ALTER COLUMN "tasks_completed_on_time" SET DATA TYPE TEXT,
ALTER COLUMN "tasks_completed_late" DROP DEFAULT,
ALTER COLUMN "tasks_completed_late" SET DATA TYPE TEXT,
ALTER COLUMN "tasks_pending" DROP DEFAULT,
ALTER COLUMN "tasks_pending" SET DATA TYPE TEXT,
ALTER COLUMN "total_focus_minutes" DROP DEFAULT,
ALTER COLUMN "total_focus_minutes" SET DATA TYPE TEXT,
ALTER COLUMN "total_tasks_completed" DROP DEFAULT,
ALTER COLUMN "total_tasks_completed" SET DATA TYPE TEXT,
ALTER COLUMN "streak" DROP DEFAULT,
ALTER COLUMN "streak" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "analytics_user_id_key" ON "analytics"("user_id");

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
