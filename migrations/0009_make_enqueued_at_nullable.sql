ALTER TABLE "user_vocabulary_item" ALTER COLUMN "enqueued_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_vocabulary_item" ALTER COLUMN "enqueued_at" DROP NOT NULL;