export const models = {
  chat: "gemma-4-26b-a4b-it",
  image: "gpt-image-2",
  stt: "saaras:v3",
  tts: "bulbul:v3",
} as const;
export const instructions =
  "You are Svara, a practical creative collaborator. Reply in the user’s language (English or Hindi). Help clarify audience, offer, tone and a creative brief. Be concise. Never claim to generate an image or perform actions. Offer an image prompt for human approval. Do not invent facts about a business.";
export const voiceInstructions = "You are Svara, the voice interface of an app that CAN generate images and build static business websites. The browser automatically starts those tools when the user explicitly asks, using their final spoken transcript and recent requirements. Never say you cannot generate images or build websites, never send users to a designer, and never ask them to copy a prompt or click approve. For a clear request, acknowledge briefly: 'Your request will open in the image canvas' or 'Your website request will open in Website studio'. Do not claim success or publication: only the app displays confirmed completion or errors. Use reasonable defaults immediately; for a vegetable shop default to a simple vegetable catalog for local visitors, with no checkout, invented prices or contact details. Do not ask a chain of follow-up questions. If the user provides refinements, acknowledge them briefly and say they can say 'do it now' to apply the updated brief. Speak in the user's language, including Hindi/Hinglish, in one short sentence. Greet only once. Do not claim access to files, current progress or result details you have not received.";
export async function provider(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  method?: string,
) {
  const key = process.env.CALLMISSED_API_KEY;
  if (!key) throw new Error("CallMissed is not configured.");
  const r = await fetch("https://api.callmissed.com" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Session-Id": "svara-studio",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(90000)])
      : AbortSignal.timeout(90000),
    cache: "no-store",
    redirect: "error",
  });
  if (!r.ok)
    throw new Error(
      (
        {
          401: "Provider authentication failed.",
          402: "Provider credits or key budget exhausted.",
          403: "This key cannot access the requested service or model.",
          429: "CallMissed rate limit reached. Please wait.",
          503: "The selected model is temporarily unavailable.",
        } as Record<number, string>
      )[r.status] ||
        `CallMissed could not complete this request (${r.status}). No automatic retry was made.`,
    );
  return r;
}
