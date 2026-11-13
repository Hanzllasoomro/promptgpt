/** Bring-your-own-key storage: browser localStorage only.
 *
 * Keys never leave the device except as the X-LLM-API-Key header on a
 * chat request to the user's own backend. The backend never stores
 * them (see backend/app/security.py). Clearing here removes them
 * completely; there is nothing server-side to delete.
 */
const PREFIX = "promptgpt:key:";

export function getKey(provider: string): string {
  return localStorage.getItem(PREFIX + provider) || "";
}

export function setKey(provider: string, key: string): void {
  if (key.trim()) localStorage.setItem(PREFIX + provider, key.trim());
  else localStorage.removeItem(PREFIX + provider);
}

export function hasKey(provider: string): boolean {
  return getKey(provider).length >= 8;
}

export function masked(key: string): string {
  if (!key) return "Not set";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

const LAST_PROVIDER_KEY = "promptgpt:chat-provider";

/** Last provider used in Chat, so the tab reopens on it instead of
 * always defaulting to OpenAI (which bounced users with only a Gemini
 * key saved back to the Keys tab). */
export function getLastProvider(): string {
  return localStorage.getItem(LAST_PROVIDER_KEY) || "";
}

export function setLastProvider(provider: string): void {
  if (provider) localStorage.setItem(LAST_PROVIDER_KEY, provider);
}

/** Chat reply-length / creativity prefs, persisted like the provider.
 * Defaults match the backend (1024 tokens, 0.7); an unknown stored
 * value falls back to the default instead of breaking the request. */
const LAST_LENGTH_KEY = "promptgpt:chat-length";
const LAST_TEMPERATURE_KEY = "promptgpt:chat-temperature";
export const CHAT_LENGTHS = [512, 1024, 2048, 4096];
export const CHAT_TEMPERATURES = [0.2, 0.7, 1.0];

export function getLastLength(): number {
  const n = Number(localStorage.getItem(LAST_LENGTH_KEY));
  return CHAT_LENGTHS.includes(n) ? n : 1024;
}

export function setLastLength(n: number): void {
  if (CHAT_LENGTHS.includes(n)) localStorage.setItem(LAST_LENGTH_KEY, String(n));
}

export function getLastTemperature(): number {
  const n = Number(localStorage.getItem(LAST_TEMPERATURE_KEY));
  return CHAT_TEMPERATURES.includes(n) ? n : 0.7;
}

export function setLastTemperature(n: number): void {
  if (CHAT_TEMPERATURES.includes(n)) localStorage.setItem(LAST_TEMPERATURE_KEY, String(n));
}

export function clearAllKeys(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
