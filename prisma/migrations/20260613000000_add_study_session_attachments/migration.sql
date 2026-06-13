ALTER TABLE "attachment" ADD COLUMN "user_id" TEXT;

CREATE TABLE "study_session_attachment" (
    "study_session_id" INTEGER NOT NULL,
    "attachment_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_session_attachment_pkey" PRIMARY KEY ("study_session_id","attachment_id","user_id")
);

ALTER TABLE "attachment" ADD CONSTRAINT "attachment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "study_session_attachment" ADD CONSTRAINT "study_session_attachment_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_session"("study_session_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "study_session_attachment" ADD CONSTRAINT "study_session_attachment_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachment"("attachment_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "study_session_attachment" ADD CONSTRAINT "study_session_attachment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
