// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Template } from "../types";

const SYSTEM_INSTRUCTION = `You are an expert audio transcription and language processing assistant.
Process the audio file provided according to the user's instructions.
Be accurate, natural, and respect the output format requested.`;

export function buildPrompt(template: Template): string {
  const parts: string[] = [SYSTEM_INSTRUCTION, "", template.prompt_body];

  if (template.output_language === "en") {
    parts.push("\nAlways respond in English.");
  } else if (template.output_language === "ar") {
    parts.push("\nدائماً أجب باللغة العربية.");
  }

  return parts.join("\n");
}
