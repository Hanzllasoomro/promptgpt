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
