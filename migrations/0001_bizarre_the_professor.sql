CREATE TABLE "user_vocabulary_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vocabulary_item_id" uuid NOT NULL,
	"encounter_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'waiting' NOT NULL,
	"enqueued_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocabulary_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"value" varchar(255) NOT NULL,
	"definition" varchar(512) NOT NULL,
	"ua_translation" varchar(255) NOT NULL,
	"part_of_speech" varchar(32),
	"spelling" varchar(255) NOT NULL,
	"pronunciation" varchar(512),
	"link" varchar(512),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vocabulary_item_value_part_of_speech_idx" UNIQUE NULLS NOT DISTINCT("value","part_of_speech")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vocabulary_list_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_list_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vocabulary_list_id" uuid NOT NULL,
	"vocabulary_item_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_vocabulary_item" ADD CONSTRAINT "user_vocabulary_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vocabulary_item" ADD CONSTRAINT "user_vocabulary_item_vocabulary_item_id_vocabulary_item_id_fk" FOREIGN KEY ("vocabulary_item_id") REFERENCES "public"."vocabulary_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_list_item" ADD CONSTRAINT "vocabulary_list_item_vocabulary_list_id_vocabulary_list_id_fk" FOREIGN KEY ("vocabulary_list_id") REFERENCES "public"."vocabulary_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_list_item" ADD CONSTRAINT "vocabulary_list_item_vocabulary_item_id_vocabulary_item_id_fk" FOREIGN KEY ("vocabulary_item_id") REFERENCES "public"."vocabulary_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_vocabulary_item_user_id_vocabulary_item_id_idx" ON "user_vocabulary_item" USING btree ("user_id","vocabulary_item_id");--> statement-breakpoint
CREATE INDEX "user_vocabulary_item_vocabulary_item_id_idx" ON "user_vocabulary_item" USING btree ("vocabulary_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vocabulary_list_item_vocabulary_list_id_vocabulary_item_id_idx" ON "vocabulary_list_item" USING btree ("vocabulary_list_id","vocabulary_item_id");--> statement-breakpoint
CREATE INDEX "vocabulary_list_item_vocabulary_item_id_idx" ON "vocabulary_list_item" USING btree ("vocabulary_item_id");