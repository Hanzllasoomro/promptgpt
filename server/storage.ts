import type { GeneratedPrompt, InsertGeneratedPrompt } from "@shared/schema";

export interface IStorage {
  createGeneratedPrompt(prompt: InsertGeneratedPrompt): Promise<GeneratedPrompt>;
  getGeneratedPrompts(): Promise<GeneratedPrompt[]>;
  getGeneratedPrompt(id: number): Promise<GeneratedPrompt | undefined>;
}

export class MemoryStorage implements IStorage {
  private prompts: GeneratedPrompt[] = [];
  private nextId = 1;

  async createGeneratedPrompt(prompt: InsertGeneratedPrompt): Promise<GeneratedPrompt> {
    const newPrompt: GeneratedPrompt = {
      ...prompt,
      id: this.nextId++,
      createdAt: new Date(),
    };
    this.prompts.unshift(newPrompt);
    return newPrompt;
  }

  async getGeneratedPrompts(): Promise<GeneratedPrompt[]> {
    return this.prompts;
  }

  async getGeneratedPrompt(id: number): Promise<GeneratedPrompt | undefined> {
    return this.prompts.find((prompt) => prompt.id === id);
  }
}

export const storage = new MemoryStorage();
