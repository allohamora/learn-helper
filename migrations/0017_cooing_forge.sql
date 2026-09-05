ALTER TABLE "reading" ALTER COLUMN "duration_ms" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "last_flushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "hour_bucket" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "event_reading_time_spent_hourly_bucket_idx" ON "event" USING btree ("user_id","reading_id","hour_bucket");