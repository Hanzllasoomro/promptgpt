import { z } from 'zod';
import { insertGeneratedPromptSchema, type GeneratedPrompt } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  prompts: {
    generate: {
      method: 'POST' as const,
      path: '/api/prompts/generate',
      input: z.object({
        idea: z.string().min(1, "Idea is required"),
      }),
      responses: {
        200: z.custom<GeneratedPrompt>(),
        500: errorSchemas.internal,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/prompts',
      responses: {
        200: z.array(z.custom<GeneratedPrompt>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/prompts/:id',
      responses: {
        200: z.custom<GeneratedPrompt>(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type GeneratePromptInput = z.infer<typeof api.prompts.generate.input>;
export type PromptResponse = z.infer<typeof api.prompts.generate.responses[200]>;
