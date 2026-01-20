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
import fileUpload from "express-fileupload";
import path from "path";
import fs from "fs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup file upload middleware
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    useTempFiles: true,
    tempFileDir: "/tmp/"
  }));

  // Serve uploads
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  }, (req, res, next) => {
    // Basic static server for uploads
    const filePath = path.join(uploadsDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).end();
    }
  });

  // Register integration routes
  registerChatRoutes(app);
  registerImageRoutes(app);
  registerAudioRoutes(app);

  // API Routes for PromptGPT
  app.post(api.prompts.generate.path, async (req, res) => {
    try {
      const { idea } = req.body; // Use req.body directly since Zod might fail on FormData
      const attachments: any[] = [];
      const userMessages: any[] = [{ role: "user", content: [{ type: "text", text: idea }] }];

      // Handle file uploads
      if (req.files && req.files.files) {
        const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
        for (const file of files) {
          const fileName = `${Date.now()}-${file.name}`;
          const filePath = path.join(process.cwd(), "uploads", fileName);
          await file.mv(filePath);
          
          const fileUrl = `/uploads/${fileName}`;
          attachments.push({ name: file.name, type: file.mimetype, url: fileUrl });

          // If it's an image, add to OpenAI prompt
          if (file.mimetype.startsWith("image/")) {
            const base64 = fs.readFileSync(filePath).toString("base64");
            userMessages[0].content.push({
              type: "image_url",
              image_url: { url: `data:${file.mimetype};base64,${base64}` }
            });
          } else {
            // For other files, we'll mention them in text
            userMessages[0].content[0].text += `\n\n[Attachment: ${file.name} (${file.mimetype})]`;
          }
        }
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1", // Using gpt-5.1 for multimodal
        messages: [
          { role: "system", content: MAGIC_SYSTEM_PROMPT },
          ...userMessages
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
