-- CreateTable
CREATE TABLE "overload_warning" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "warnings" JSONB NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "overload_warning_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "overload_warning" ADD CONSTRAINT "overload_warning_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
