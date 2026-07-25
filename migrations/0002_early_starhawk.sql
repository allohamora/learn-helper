CREATE TABLE "user_vocabulary_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vocabulary_list_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_vocabulary_list" ADD CONSTRAINT "user_vocabulary_list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vocabulary_list" ADD CONSTRAINT "user_vocabulary_list_vocabulary_list_id_vocabulary_list_id_fk" FOREIGN KEY ("vocabulary_list_id") REFERENCES "public"."vocabulary_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_vocabulary_list_user_id_vocabulary_list_id_idx" ON "user_vocabulary_list" USING btree ("user_id","vocabulary_list_id");--> statement-breakpoint
CREATE INDEX "user_vocabulary_list_vocabulary_list_id_idx" ON "user_vocabulary_list" USING btree ("vocabulary_list_id");