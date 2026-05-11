import type { ProjectBranding } from "../config";
import type { NormalizedBranding } from "./types";

export function normalizeBranding(branding: ProjectBranding | undefined): NormalizedBranding | null {
  if (!branding) return null;

  const displayName = typeof branding.displayName === "string" ? branding.displayName.trim() : "";

  if (!displayName) return null;

  return {
    displayName,
  };
}
