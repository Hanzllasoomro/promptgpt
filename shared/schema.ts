import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const generatedPrompts = pgTable("generated_prompts", {
  id: serial("id").primaryKey(),
  originalIdea: text("original_idea").notNull(),
  magicPrompt: text("magic_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"), // For any extra info
  attachments: jsonb("attachments").default([]), // Store file info: { name, type, url }
});

export const insertGeneratedPromptSchema = createInsertSchema(generatedPrompts).omit({ 
  id: true, 
  createdAt: true 
});

export type GeneratedPrompt = typeof generatedPrompts.$inferSelect;
export type InsertGeneratedPrompt = z.infer<typeof insertGeneratedPromptSchema>;

// Export chat models from integration
export * from "./models/chat";
