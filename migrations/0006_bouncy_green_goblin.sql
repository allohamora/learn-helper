CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(48) NOT NULL,
	"user_vocabulary_item_id" uuid,
	"user_vocabulary_item_ids" jsonb,
	"vocabulary_item_id" uuid,
	"user_vocabulary_list_id" uuid,
	"status" varchar(16),
	"user_vocabulary_item_task_type" varchar(48),
	"field_name" text,
	"duration_ms" integer,
	"encounter_count" integer,
	"cost_in_nano_dollars" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_user_vocabulary_item_id_user_vocabulary_item_id_fk" FOREIGN KEY ("user_vocabulary_item_id") REFERENCES "public"."user_vocabulary_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_vocabulary_item_id_vocabulary_item_id_fk" FOREIGN KEY ("vocabulary_item_id") REFERENCES "public"."vocabulary_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_user_vocabulary_list_id_user_vocabulary_list_id_fk" FOREIGN KEY ("user_vocabulary_list_id") REFERENCES "public"."user_vocabulary_list"("id") ON DELETE restrict ON UPDATE no action;