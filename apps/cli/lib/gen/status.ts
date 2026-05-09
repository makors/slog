import { createLogUpdate } from "log-update";
import pc from "picocolors";
import { isInteractive } from "../cli";

const logUpdate = createLogUpdate(process.stdout, { showCursor: true });

const DEFAULT_VERBS = [
  "slogging",
  "shipping",
  "drafting",
  "exploring",
  "polishing",
  "discombobulating", // had to steal this from claude code
];

const FRAME_INTERVAL_MS = 70;
const VERB_INTERVAL_MS = 10_000;

type Timer = ReturnType<typeof setInterval>;

export type AgentStatus = {
  start: () => void;
  update: (detail: string) => void;
  stop: () => void;
};

export type AgentStatusOptions = {
  verbs?: string[];
  initialDetail?: string;
};

function supportsTrueColor(): boolean {
  const colorTerm = process.env.COLORTERM?.toLowerCase();
  if (colorTerm === "truecolor" || colorTerm === "24bit") return true;

  return Boolean(process.env.TERM_PROGRAM);
}

function gray(value: number, text: string): string {
  return `\x1b[38;2;${value};${value};${value}m${text}\x1b[0m`;
}

/*
 * Shimmer effect used for agent status animations.
 * Gaussian highlight (math... fancy!)
 */
function shimmer(text: string, frame: number): string {
  const chars = [...text];
  const cycle = chars.length + 6;
  // Head position sweeps from -3 to length+3 so the highlight enters and
  // exits fully off-screen — no visible jump when it wraps.
  const head = ((frame * 0.35) % cycle) - 3;

  return chars
    .map((char, index) => {
      const distance = index - head;
      const intensity = Math.exp(-(distance * distance) / 6);
      const value = Math.round(130 + intensity * 125);
      return gray(value, char);
    })
    .join("");
}

function dot(frame: number): string {
  const value = frame % 12 < 6 ? 245 : 120;
  return gray(value, "●");
}

/*
 * Renders the "header" of the agent status -
 * essentially the verb and dot, though agent actions live in sub-detail.
 */
function renderHeader(verb: string, frame: number, useTrueColor: boolean): string {
  if (!useTrueColor) {
    return `${pc.white("●")} ${pc.white(verb)}`;
  }

  return `${dot(frame)} ${shimmer(verb, frame)}`;
}

export function createAgentStatus(options: AgentStatusOptions = {}): AgentStatus {
  const verbs = options.verbs?.length ? options.verbs : DEFAULT_VERBS;
  const useAnimation = isInteractive() && supportsTrueColor();

  let frame = 0;
  let verbIndex = 0;
  let detail = options.initialDetail ?? "starting";
  let renderTimer: Timer | undefined;
  let verbTimer: Timer | undefined;
  let stopped = false;

  function render() {
    const verb = verbs[verbIndex] ?? DEFAULT_VERBS[0];
    const header = renderHeader(verb, frame, useAnimation);

    logUpdate(`${header}\n${pc.dim(`│ ${detail}`)}`);
    frame++;
  }

  return {
    start() {
      if (!isInteractive()) return;

      stopped = false;
      render();

      if (!useAnimation) return;

      renderTimer = setInterval(render, FRAME_INTERVAL_MS);
      verbTimer = setInterval(() => {
        verbIndex = (verbIndex + 1) % verbs.length;
        render();
      }, VERB_INTERVAL_MS);
    },

    update(nextDetail: string) {
      detail = nextDetail;
      if (!isInteractive() || stopped) return;

      render();
    },

    stop() {
      stopped = true;

      if (renderTimer) clearInterval(renderTimer);
      if (verbTimer) clearInterval(verbTimer);

      renderTimer = undefined;
      verbTimer = undefined;

      if (isInteractive()) {
        logUpdate.clear();
        logUpdate.done();
      }
    },
  };
}
