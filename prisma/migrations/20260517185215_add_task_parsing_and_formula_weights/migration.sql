-- AlterTable
ALTER TABLE "user" ADD COLUMN     "ai_analyzed_at" TIMESTAMP(3),
ADD COLUMN     "ai_priority_score" INTEGER,
ADD COLUMN     "confidence_score" INTEGER,
ADD COLUMN     "estimated_minutes" INTEGER,
ADD COLUMN     "grade_weight_percent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "user_formula_weights" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "w_impact" DECIMAL(4,2) NOT NULL DEFAULT 3.0,
    "w_confidence" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "w_ease" DECIMAL(4,2) NOT NULL DEFAULT 2.0,
    "w_urgency" DECIMAL(4,2) NOT NULL DEFAULT 4.0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_formula_weights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_formula_weights_user_id_key" ON "user_formula_weights"("user_id");
