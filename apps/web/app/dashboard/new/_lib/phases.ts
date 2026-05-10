export type PhaseId = "connect" | "deploy";
export type PhaseState = "pending" | "active" | "done" | "complete";

export interface Phase {
  id: PhaseId;
  label: string;
  doneLabel: string;
  hint: string;
}

export const PHASES: Phase[] = [
  {
    id: "connect",
    label: "Connect your repo",
    doneLabel: "Repo connected via CLI",
    hint: "You're one command from slogging away.",
  },
  {
    id: "deploy",
    label: "Deploy",
    doneLabel: "Deployed",
    hint: "",
  },
];

export function getPhaseState(
  id: PhaseId,
  active: PhaseId,
  allDone: boolean,
): PhaseState {
  const activeIdx = PHASES.findIndex((p) => p.id === active);
  const idx = PHASES.findIndex((p) => p.id === id);
  if (idx < activeIdx) return "done";
  if (idx === activeIdx) return allDone ? "done" : "active";
  return "pending";
}
