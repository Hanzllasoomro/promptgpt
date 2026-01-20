# PromptGPT

## Overview

PromptGPT is an intelligent prompt-structuring application that transforms raw user ideas into production-grade, structured AI prompts using a proprietary "MAGIC PROMPT" format. The application takes vague thoughts and converts them into deeply structured, optimized prompts designed to maximize AI model output quality.

The core value proposition is eliminating the friction between having an idea and knowing how to ask AI correctly. Generated prompts follow a strict professional-grade structure that forces AI models to reason deeply, respect constraints, and deliver deterministic, high-quality outputs.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Animations**: Framer Motion for morphing background effects and UI transitions
- **Build Tool**: Vite with React plugin and custom Replit integrations

### Backend Architecture
- **Framework**: Express.js 5 running on Node.js
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful endpoints under `/api` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod for runtime type validation with drizzle-zod integration

### Data Storage
- **Database**: PostgreSQL accessed via Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Key Tables**:
  - `generated_prompts`: Stores original ideas, generated magic prompts, and metadata
  - `conversations` and `messages`: Chat history for AI integrations

### AI Integration
- **Provider**: OpenAI API (via Replit AI Integrations)
- **Model**: GPT-5.1 for prompt generation
- **System Prompt**: Custom MAGIC PROMPT template defined in `server/prompts.ts`
- **Additional Capabilities**: Image generation (gpt-image-1), text-to-speech, speech-to-text

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/  # UI components including Shadcn
│       ├── hooks/       # Custom React hooks
│       ├── pages/       # Route components
│       └── lib/         # Utilities and query client
├── server/           # Express backend
│   ├── replit_integrations/  # AI service integrations
│   └── routes.ts     # API route definitions
├── shared/           # Shared types and schemas
│   ├── schema.ts     # Drizzle database schema
│   └── routes.ts     # API route type definitions
└── migrations/       # Drizzle database migrations
```

### API Design
Routes are defined in `shared/routes.ts` with full type safety:
- `POST /api/prompts/generate`: Generate a MAGIC PROMPT from an idea
- `GET /api/prompts`: List all generated prompts
- `GET /api/prompts/:id`: Get a specific prompt

## External Dependencies

### Database
- **PostgreSQL**: Primary data store accessed via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations via `npm run db:push`

### AI Services (Replit AI Integrations)
- **OpenAI API**: Chat completions, image generation, audio processing
- **Environment Variables**:
  - `AI_INTEGRATIONS_OPENAI_API_KEY`
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Key npm Packages
- `@tanstack/react-query`: Data fetching and caching
- `drizzle-orm` + `drizzle-zod`: Database ORM with type generation
- `framer-motion`: Animation library for UI effects
- `react-markdown`: Render generated prompts
- `shadcn/ui` components: Full suite of accessible UI primitives