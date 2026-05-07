import { getConfig, getToken } from "../lib/config";
import { success } from "../lib/cli";

export async function publish() {
  const config = await getConfig();
  if (!config) throw new Error("missing .slog.json\n\nrun: slog init <token>");

  const token = await getToken(config.projectId);
  if (!token) throw new Error("missing token\n\nset SLOG_TOKEN or run: slog init <token>");

  success(`loaded project ${config.projectId}`);
  success(`ready to publish to ${config.baseUrl}`);
}
