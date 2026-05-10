import type { Metadata } from "next";

import { NewProjectStepper } from "./stepper";

export const metadata: Metadata = {
  title: "New project",
  description: "Create a slog project and connect the CLI to your repository.",
};

export default function NewProjectPage() {
  return <NewProjectStepper />;
}
