ALTER TABLE "projects" ADD COLUMN "scraps_paid_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "projects" SET "scraps_paid_amount" = "scraps_awarded" WHERE "scraps_paid_at" IS NOT NULL;
