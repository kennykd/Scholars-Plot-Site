/*
  Warnings:

  - You are about to drop the column `w_confidence` on the `user_formula_weights` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_formula_weights" DROP CONSTRAINT "user_formula_weights_user_id_fkey";

-- AlterTable
ALTER TABLE "user_formula_weights" DROP COLUMN "w_confidence",
ADD COLUMN     "last_adapted_at" TIMESTAMP(3),
ADD COLUMN     "tasks_since_last" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "w_ease" SET DEFAULT 3.0;

-- AddForeignKey
ALTER TABLE "user_formula_weights" ADD CONSTRAINT "user_formula_weights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
