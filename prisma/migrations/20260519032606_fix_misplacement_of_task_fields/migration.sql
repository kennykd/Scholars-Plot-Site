/*
  Warnings:

  - You are about to drop the column `ai_analyzed_at` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `ai_priority_score` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `confidence_score` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `estimated_minutes` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `grade_weight_percent` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "task" ADD COLUMN     "ai_analyzed_at" TIMESTAMP(3),
ADD COLUMN     "ai_priority_score" INTEGER,
ADD COLUMN     "confidence_score" INTEGER,
ADD COLUMN     "estimated_minutes" INTEGER,
ADD COLUMN     "grade_weight_percent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "user" DROP COLUMN "ai_analyzed_at",
DROP COLUMN "ai_priority_score",
DROP COLUMN "confidence_score",
DROP COLUMN "estimated_minutes",
DROP COLUMN "grade_weight_percent";
