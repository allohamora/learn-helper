ALTER TABLE "event" DROP CONSTRAINT "event_reading_id_reading_id_fk";
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_reading_id_reading_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."reading"("id") ON DELETE cascade ON UPDATE no action;