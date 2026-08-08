ALTER TABLE "vocabulary_list" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_list" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "vocabulary_list" ADD COLUMN "type" varchar(16) DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_list" ADD CONSTRAINT "vocabulary_list_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vocabulary_list_owner_id_personal_idx" ON "vocabulary_list" USING btree ("owner_id") WHERE "vocabulary_list"."type" = 'personal';--> statement-breakpoint
ALTER TABLE "vocabulary_list" ADD CONSTRAINT "vocabulary_list_personal_owner_id_check" CHECK ("vocabulary_list"."type" != 'personal' OR "vocabulary_list"."owner_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "vocabulary_list" ADD CONSTRAINT "vocabulary_list_public_title_check" CHECK ("vocabulary_list"."type" != 'public' OR "vocabulary_list"."title" IS NOT NULL);