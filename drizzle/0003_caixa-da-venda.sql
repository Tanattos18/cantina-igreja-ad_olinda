ALTER TABLE "usuarios" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "vendas" ADD COLUMN "caixa_usuario_id" integer;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_caixa_usuario_id_usuarios_id_fk" FOREIGN KEY ("caixa_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;