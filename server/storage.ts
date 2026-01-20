import { db } from "./db";
import { generatedPrompts, type InsertGeneratedPrompt, type GeneratedPrompt } from "@shared/schema";
import { chatStorage, type IChatStorage } from "./replit_integrations/chat/storage";
import { desc, eq } from "drizzle-orm";

export interface IStorage extends IChatStorage {
  createGeneratedPrompt(prompt: InsertGeneratedPrompt): Promise<GeneratedPrompt>;
  getGeneratedPrompts(): Promise<GeneratedPrompt[]>;
  getGeneratedPrompt(id: number): Promise<GeneratedPrompt | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Inherit chat storage methods
  getConversation = chatStorage.getConversation;
  getAllConversations = chatStorage.getAllConversations;
  createConversation = chatStorage.createConversation;
  deleteConversation = chatStorage.deleteConversation;
  getMessagesByConversation = chatStorage.getMessagesByConversation;
  createMessage = chatStorage.createMessage;

  async createGeneratedPrompt(prompt: InsertGeneratedPrompt): Promise<GeneratedPrompt> {
    const [newPrompt] = await db
      .insert(generatedPrompts)
      .values(prompt)
      .returning();
    return newPrompt;
  }

  async getGeneratedPrompts(): Promise<GeneratedPrompt[]> {
    return await db
      .select()
      .from(generatedPrompts)
      .orderBy(desc(generatedPrompts.createdAt));
  }

  async getGeneratedPrompt(id: number): Promise<GeneratedPrompt | undefined> {
    const [prompt] = await db
      .select()
      .from(generatedPrompts)
      .where(eq(generatedPrompts.id, id));
    return prompt;
  }
}

export const storage = new DatabaseStorage();
