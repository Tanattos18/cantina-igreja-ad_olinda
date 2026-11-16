ALTER TABLE "usuarios" ADD COLUMN "convite_hash" text;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "convite_expira_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_convite_hash_unique" UNIQUE("convite_hash");