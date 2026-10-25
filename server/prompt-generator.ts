import type { Attachment } from "@shared/schema";

export function generateLocalPrompt(idea: string, attachments: Attachment[]): string {
  const attachmentContext = attachments.length
    ? `\nReference materials:\n${attachments.map((file) => `- ${file.name} (${file.type})`).join("\n")}`
    : "";

  return `# MAGIC PROMPT\n\n## Role\nAct as a thoughtful expert who can turn an idea into a clear, useful result.\n\n## Objective\n${idea.trim()}\n\n## Context\nUse the user's objective as the source of truth. Ask focused questions only when a missing detail would materially change the result.${attachmentContext}\n\n## Requirements\n- State important assumptions before acting.\n- Organize the response with useful headings.\n- Prefer concrete examples and actionable details.\n- Keep the result aligned with the intended audience and desired outcome.\n\n## Output\nDeliver a polished answer that directly addresses the objective. Include a brief summary, the main result, and practical next steps where appropriate.`;
}