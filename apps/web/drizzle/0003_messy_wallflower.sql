CREATE TABLE "project_release" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"source_commit" text,
	"content_hash" text NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_release_file" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"content_markdown" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_release" ADD CONSTRAINT "project_release_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_release_file" ADD CONSTRAINT "project_release_file_release_id_project_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projectRelease_projectId_idx" ON "project_release" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projectRelease_projectId_version_idx" ON "project_release" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "projectReleaseFile_releaseId_idx" ON "project_release_file" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projectReleaseFile_releaseId_path_idx" ON "project_release_file" USING btree ("release_id","path");
