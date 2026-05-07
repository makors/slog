import pc from "picocolors";
import prompts from "prompts";

/*
 * Check if the running shell is interactive;
 * necessary for CI/CD environments.
 */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function ask(question: string, defaultValue?: string): Promise<string> {
  if (!isInteractive()) throw new Error("cannot prompt in a non-interactive shell");

  const response = await prompts({
    type: "text",
    name: "value",
    message: question,
    initial: defaultValue,
  });

  return typeof response.value === "string" ? response.value.trim() : "";
}

export async function askSecret(question: string): Promise<string> {
  if (!isInteractive()) throw new Error("cannot prompt in a non-interactive shell");

  const response = await prompts({
    type: "password",
    name: "value",
    message: question,
  });

  return typeof response.value === "string" ? response.value.trim() : "";
}

export function banner(version: string) {
  console.log(`${pc.bold("slog")} ${pc.dim(`v${version}`)} 🪵\n`);
}

export function step(message: string) {
  console.log(`${pc.cyan("•")} ${message}`);
}

export function success(message: string) {
  console.log(`${pc.green("✓")} ${message}`);
}

export function warn(message: string) {
  console.log(`${pc.yellow("!")} ${message}`);
}

export function info(message: string) {
  console.log(`${pc.dim("→")} ${message}`);
}
