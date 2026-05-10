CREATE TABLE "project_join_code" (
	"code" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"claimed_project_id" text,
	"claimed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_join_code" ADD CONSTRAINT "project_join_code_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_join_code" ADD CONSTRAINT "project_join_code_claimed_project_id_project_id_fk" FOREIGN KEY ("claimed_project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projectJoinCode_ownerUserId_idx" ON "project_join_code" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "projectJoinCode_claimedProjectId_idx" ON "project_join_code" USING btree ("claimed_project_id");
