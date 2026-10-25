import { z } from "zod";

export const attachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  url: z.string(),
});

export const insertGeneratedPromptSchema = z.object({
  originalIdea: z.string().min(1),
  magicPrompt: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  attachments: z.array(attachmentSchema).default([]),
});

export type Attachment = z.infer<typeof attachmentSchema>;
export type GeneratedPrompt = z.infer<typeof insertGeneratedPromptSchema> & {
  id: number;
  createdAt: Date;
};
export type InsertGeneratedPrompt = z.infer<typeof insertGeneratedPromptSchema>;
