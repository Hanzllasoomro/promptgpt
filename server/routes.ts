import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { openai } from "./replit_integrations/image"; // Use the client from image integration
import { MAGIC_SYSTEM_PROMPT } from "./prompts";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register integration routes
  registerChatRoutes(app);
  registerImageRoutes(app);
  registerAudioRoutes(app);

  // API Routes for PromptGPT
  app.post(api.prompts.generate.path, async (req, res) => {
    try {
      const { idea } = api.prompts.generate.input.parse(req.body);

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: MAGIC_SYSTEM_PROMPT },
          { role: "user", content: idea },
        ],
      });

      const magicPromptContent = completion.choices[0]?.message?.content || "";

      if (!magicPromptContent) {
        throw new Error("Failed to generate prompt");
      }

      const savedPrompt = await storage.createGeneratedPrompt({
        originalIdea: idea,
        magicPrompt: magicPromptContent,
        metadata: {},
      });

      res.status(200).json(savedPrompt); // 200 OK
    } catch (err) {
      console.error("Error generating prompt:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.prompts.list.path, async (req, res) => {
    try {
      const prompts = await storage.getGeneratedPrompts();
      res.json(prompts);
    } catch (err) {
      console.error("Error fetching prompts:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.prompts.get.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const prompt = await storage.getGeneratedPrompt(id);
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json(prompt);
    } catch (err) {
      console.error("Error fetching prompt:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
