DO $$ BEGIN
 CREATE TYPE "template_type" AS ENUM('range', 'list', 'pattern');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_code_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"template_type" "template_type" NOT NULL,
	"start_code" varchar(50),
	"end_code" varchar(50),
	"code_list" text[],
	"pattern" varchar(255),
	"description" text,
	"faculty" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subject_code_templates" ADD CONSTRAINT "subject_code_templates_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subject_code_templates" ADD CONSTRAINT "subject_code_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_code_templates_university_id_idx" ON "subject_code_templates" ("university_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_code_templates_active_idx" ON "subject_code_templates" ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_code_templates_priority_idx" ON "subject_code_templates" ("priority" DESC);
