import { getToken, requireConfig } from "../lib/config";
import { success } from "../lib/cli";

export async function publish() {
  const config = await requireConfig();

  const token = await getToken(config.projectId);
  if (!token) throw new Error("missing token\n\nset SLOG_TOKEN or run: slog init");

  success(`loaded project ${config.projectId}`);
  success(`ready to publish to ${config.baseUrl}`);
}
