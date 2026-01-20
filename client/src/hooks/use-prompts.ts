import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type GeneratePromptInput } from "@shared/routes";

export function usePrompts() {
  return useQuery({
    queryKey: [api.prompts.list.path],
    queryFn: async () => {
      const res = await fetch(api.prompts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch prompts");
      return api.prompts.list.responses[200].parse(await res.json());
    },
  });
}

export function usePrompt(id: number) {
  return useQuery({
    queryKey: [api.prompts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.prompts.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch prompt");
      return api.prompts.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useGeneratePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: GeneratePromptInput) => {
      // Validate input locally before sending
      const validated = api.prompts.generate.input.parse(data);
      
      const res = await fetch(api.prompts.generate.path, {
        method: api.prompts.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to generate prompt");
      }
      
      return api.prompts.generate.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Invalidate list to show new item in history
      queryClient.invalidateQueries({ queryKey: [api.prompts.list.path] });
    },
  });
}
