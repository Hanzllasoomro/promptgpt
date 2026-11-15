export interface GenerateResponse {
  original_idea: string;
  engineered_prompt: string;
  concise_prompt: string;
  tips: string[];
  task_type: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  default_model: string;
  models: string[];
  needs_key: boolean;
  key_help: string;
  supports_base_url: boolean;
}

export interface ChatbotInfo {
  id: string;
  name: string;
  url: string;
  prefilled: boolean;
  note: string;
}

export interface HistoryItem {
  id: string;
  createdAt: string;
  idea: string;
  engineered_prompt: string;
}

export interface DimensionScore {
  id: string;
  name: string;
  score: number;
  findings: string[];
  suggestion: string | null;
}

export interface EvaluateResponse {
  overall: number;
  verdict: string;
  dimensions: DimensionScore[];
}

export interface LibraryTemplate {
  id: string;
  domain: string;
  title: string;
  description: string;
  task_type: string;
  audience: string;
  tone: string;
  output_format: string;
  length: string;
  context: string;
  example_idea: string;
}

export interface RefineRound {
  round: number;
  prompt: string;
  overall: number;
  dimensions: DimensionScore[];
  improved: boolean;
  note: string;
}

export interface RefineResponse {
  rounds: RefineRound[];
  best_prompt: string;
  best_overall: number;
  best_round: number;
  base_overall: number;
  improved_by: number;
  stopped_early: boolean;
  note: string | null;
}
