CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" integer,
	"dados" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracao" (
	"id" integer PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"igreja" text,
	"mensagem" text,
	"endereco" text,
	"cultos" text,
	"instagram" text,
	"whatsapp" text,
	"pix_tipo" text,
	"pix_chave" text,
	"pix_nome" text,
	"pix_cidade" text,
	"logo_id" integer
);
--> statement-breakpoint
CREATE TABLE "imagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"dados" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"venda_item_id" integer NOT NULL,
	"nome" text NOT NULL,
	"quantidade" integer NOT NULL,
	"preco_unitario" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"venda_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"codigo" text NOT NULL,
	"origem" text NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_telefone" text,
	"observacao" text,
	"pagar_quando" text NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"pago_em" timestamp with time zone,
	"pago_com" text,
	"entregue_em" timestamp with time zone,
	"cancelado_em" timestamp with time zone,
	"usuario_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"emoji" text,
	"imagem_id" integer,
	"preco" numeric(12, 2) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentativas_login" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"sucesso" boolean NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"perfil" text DEFAULT 'voluntario' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"trocar_senha" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "venda_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"venda_id" integer NOT NULL,
	"produto_id" integer NOT NULL,
	"preco" numeric(12, 2) NOT NULL,
	"limite" integer,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendas" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"data_retirada" date NOT NULL,
	"retirada" text,
	"encerra_em" timestamp with time zone,
	"situacao" text DEFAULT 'rascunho' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracao" ADD CONSTRAINT "configuracao_logo_id_imagens_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."imagens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_venda_item_id_venda_itens_id_fk" FOREIGN KEY ("venda_item_id") REFERENCES "public"."venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_venda_id_vendas_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_imagem_id_imagens_id_fk" FOREIGN KEY ("imagem_id") REFERENCES "public"."imagens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_venda_id_vendas_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_criado_idx" ON "auditoria" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "pedido_itens_pedido_idx" ON "pedido_itens" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "pedido_itens_venda_item_idx" ON "pedido_itens" USING btree ("venda_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_venda_numero_idx" ON "pedidos" USING btree ("venda_id","numero");--> statement-breakpoint
CREATE INDEX "pedidos_venda_idx" ON "pedidos" USING btree ("venda_id","criado_em");--> statement-breakpoint
CREATE INDEX "tentativas_email_idx" ON "tentativas_login" USING btree ("email","criado_em");--> statement-breakpoint
CREATE INDEX "tentativas_ip_idx" ON "tentativas_login" USING btree ("ip","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "venda_itens_venda_produto_idx" ON "venda_itens" USING btree ("venda_id","produto_id");--> statement-breakpoint
CREATE INDEX "vendas_situacao_idx" ON "vendas" USING btree ("situacao","data_retirada");