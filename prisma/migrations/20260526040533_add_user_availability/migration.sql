-- AlterTable
ALTER TABLE "user" ADD COLUMN     "ai_behavior_profile" JSONB,
ADD COLUMN     "ai_profile_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_formula_weights" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "user_availability" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_availability_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_formula_weights" ADD CONSTRAINT "user_formula_weights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_availability" ADD CONSTRAINT "user_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
