import type { WebsiteResult } from "./website";

export type Message = {
  role: "user" | "assistant";
  content: string;
  source?: "voice";
};
export type Session = {
  id: string;
  title: string;
  messages: Message[];
  prompt: string;
  image?: string;
  imageModel?: string;
  imagePrompt?: string;
  websiteBrief?: string;
  website?: WebsiteResult;
  created: number;
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function website(value: unknown): WebsiteResult | undefined {
  if (!object(value)) return;
  const { id, document, title, caption, whatsapp, model, usage, publicPath } = value;
  if (typeof id !== "string" || !id || typeof document !== "string" ||
      typeof title !== "string" || typeof caption !== "string" ||
      typeof whatsapp !== "string" || typeof model !== "string") return;
  return {
    id, document, title, caption, whatsapp, model,
    ...(typeof usage === "number" && Number.isFinite(usage) && usage >= 0 ? { usage } : {}),
    ...(typeof publicPath === "string" && /^\/sites\/[A-Za-z0-9_-]+$/.test(publicPath) && publicPath === `/sites/${id}` ? { publicPath } : {}),
  };
}

// Browser storage can be partially malformed. Recover each usable entry independently.
export function restoreSessions(raw: string | null): Session[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const saved: Session[] = [];
  const ids = new Set<string>();
  for (const value of parsed) {
    if (!object(value) || typeof value.id !== "string" || !value.id ||
        ids.has(value.id) || !Array.isArray(value.messages)) continue;
    const messages: Message[] = [];
    for (const message of value.messages) {
      if (!object(message) || (message.role !== "user" && message.role !== "assistant") ||
          typeof message.content !== "string") continue;
      messages.push({ role: message.role, content: message.content,
        ...(message.source === "voice" ? { source: "voice" as const } : {}) });
    }
    const session: Session = {
      id: value.id,
      title: typeof value.title === "string" ? value.title : "Untitled session",
      messages,
      prompt: typeof value.prompt === "string" ? value.prompt : "",
      created: typeof value.created === "number" && Number.isFinite(value.created) && value.created >= 0 ? value.created : 0,
    };
    for (const key of ["image", "imageModel", "imagePrompt", "websiteBrief"] as const) {
      if (typeof value[key] === "string") session[key] = value[key];
    }
    const result = website(value.website);
    if (result) session.website = result;
    saved.push(session);
    ids.add(session.id);
    if (saved.length === 12) break;
  }
  return saved;
}
