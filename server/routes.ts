import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { generateLocalPrompt } from "./prompt-generator";
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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post(api.prompts.generate.path, async (req, res) => {
    try {
      const { idea } = req.body; // Use req.body directly since Zod might fail on FormData
      const attachments: any[] = [];

      // Handle file uploads
      if (req.files && req.files.files) {
        const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
        for (const file of files) {
          const fileName = `${Date.now()}-${file.name}`;
          const filePath = path.join(process.cwd(), "uploads", fileName);
          await file.mv(filePath);
          
          const fileUrl = `/uploads/${fileName}`;
          attachments.push({ name: file.name, type: file.mimetype, url: fileUrl });

          fs.unlinkSync(filePath);
        }
      }

      const savedPrompt = await storage.createGeneratedPrompt({
        originalIdea: idea,
        magicPrompt: generateLocalPrompt(idea, attachments),
        attachments: attachments,
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
      const id = parseInt(String(req.params.id), 10);
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
