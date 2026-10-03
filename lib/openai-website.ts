import { createLedger, parseAllowance } from "./ledger";
import { websiteSchema } from "./website";
export const websiteModel = "gpt-4.1-mini-2025-04-14";
let usage: ReturnType<typeof createLedger>;
export function websiteEnabled() {
  try {
    return !!process.env.OPENAI_API_KEY && parseAllowance(process.env.OPENAI_LIMIT_CENTS) >= 10;
  } catch {
    return false;
  }
}
export async function generateWebsite(
  brief: string,
  id: string,
  owner: string,
  signal: AbortSignal,
) {
  if (!process.env.OPENAI_API_KEY)
    throw new Error(
      "Website generation needs the server’s OpenAI key. Your brief is saved; chat, images and voice remain available.",
    );
  const limit = parseAllowance(process.env.OPENAI_LIMIT_CENTS);
  if (limit < 10)
    throw new Error(
      "Set a separate OpenAI spending allowance before generating websites.",
    );
  usage ??= createLedger(
    (process.env.LEDGER_PATH || "./data/usage.sqlite") + ".openai",
  );
  usage.reserve(id, owner, "website", 10, limit);
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
    body: JSON.stringify({
      model: websiteModel,
      store: false,
      max_output_tokens: 6000,
      instructions:
        'You design distinctive, responsive single-page websites for local businesses. Create custom semantic body HTML and CSS matching the user’s business, language, mood and goals. Include a compelling hero, relevant products/services, an offer section and contact details only when supplied. Never invent addresses, reviews, awards, prices, statistics or phone numbers. Use an original composition, strong typography, expressive colors and subtle CSS animation. System fonts only. No scripts, forms, iframes, external assets, imports, tracking or external CSS URLs. A provided campaign image can be placed using <img src="{{CAMPAIGN_IMAGE}}" alt="Campaign artwork">; it may be absent, so the page must work without it. Produce matching social caption and WhatsApp copy; do not claim to send or publish anything. Do not include head/body tags in html. Ensure readable mobile layout, accessible contrast and reduced motion.',
      input: brief,
      text: {
        format: {
          type: "json_schema",
          name: "business_website",
          strict: true,
          schema: {
            type: "object",
            properties: Object.fromEntries(
              [
                "title",
                "description",
                "html",
                "css",
                "caption",
                "whatsapp",
              ].map((k) => [k, { type: "string" }]),
            ),
            required: [
              "title",
              "description",
              "html",
              "css",
              "caption",
              "whatsapp",
            ],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!r.ok)
    throw new Error(
      (
        {
          401: "OpenAI key was rejected.",
          429: "OpenAI rate or credit limit reached. No automatic retry was made.",
        } as Record<number, string>
      )[r.status] ||
        "OpenAI could not complete the website. No automatic retry was made.",
    );
  const data = await r.json();
  if (data.status !== "completed")
    throw new Error(
      "The website response was incomplete. Your previous preview is preserved.",
    );
  const parts = (data.output || []).flatMap(
    (o: { content?: { type: string; text?: string }[] }) => o.content || [],
  );
  const text = parts
    .filter((p: { type: string }) => p.type === "output_text")
    .map((p: { text?: string }) => p.text || "")
    .join("");
  if (!text)
    throw new Error(
      "OpenAI did not return a website. Try refining your brief.",
    );
  const content = websiteSchema.parse(JSON.parse(text));
  return {
    content,
    model: websiteModel,
    usage:
      typeof data.usage?.total_tokens === "number"
        ? data.usage.total_tokens
        : undefined,
  };
}
