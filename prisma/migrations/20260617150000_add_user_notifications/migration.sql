CREATE TABLE "user_notification" (
    "notification_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '/',
    "tag" TEXT,
    "source_key" TEXT,
    "read_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notification_pkey" PRIMARY KEY ("notification_id")
);

CREATE UNIQUE INDEX "user_notification_user_id_source_key_key" ON "user_notification"("user_id", "source_key");
CREATE INDEX "user_notification_user_id_dismissed_at_created_at_idx" ON "user_notification"("user_id", "dismissed_at", "created_at");
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
