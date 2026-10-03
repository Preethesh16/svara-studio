import { z } from "zod";
import { equal, identity, issue } from "@/lib/auth";
import { ledger } from "@/lib/ledger";
import { instructions, models, provider } from "@/lib/provider";
export const runtime = "nodejs";
const message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
const requestSchema = z.object({
  requestId: z.string().uuid(),
  messages: z.array(message).max(12).optional(),
  prompt: z.string().min(1).max(2000).optional(),
  language: z.enum(["en-IN", "hi-IN"]).optional(),
  id: z.string().uuid().optional(),
});
export async function GET(req: Request) {
  try {
    identity(req);
    return Response.json(
      {
        models,
        enabled: process.env.LIVE_ENABLED === "true",
        reservedCents: ledger().total(),
        limitCents: Number(process.env.APP_LIMIT_CENTS || 0),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Enter the reviewer access code to continue." },
      { status: 401 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return Response.json({ error: "Origin refused." }, { status: 403 });
    const reader = req.body?.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 56000) {
          await reader.cancel();
          return Response.json(
            { error: "Request too large." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    const raw = Buffer.concat(chunks).toString("utf8");
    const path = new URL(req.url).pathname.split("/").at(-1);
    const input = JSON.parse(raw);
    if (path === "login") {
      ledger().attempts("global");
      if (
        !process.env.REVIEWER_CODE ||
        !equal(String(input.code || ""), process.env.REVIEWER_CODE)
      )
        return Response.json(
          { error: "Access code not recognized." },
          { status: 401 },
        );
      return Response.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie": `svara=${issue()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.NODE_ENV === "production" || new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
          },
        },
      );
    }
    const owner = identity(req);
    const data = requestSchema.parse(input);
    if (path === "end") {
      if (!data.id || !ledger().owns(owner, data.id))
        return Response.json({ error: "Session not found." }, { status: 404 });
      await provider(
        `/v1/voice/sessions/${data.id}`,
        undefined,
        undefined,
        "DELETE",
      );
      return Response.json({ ok: true });
    }
    if (!["chat", "image", "voice"].includes(path || ""))
      return Response.json({ error: "Not found" }, { status: 404 });
    if (process.env.LIVE_ENABLED !== "true")
      throw new Error(
        "Live calls are paused while the remaining key allowance is verified. Your draft is saved locally.",
      );
    if (
      path === "chat" &&
      (!data.messages?.length ||
        data.messages.reduce((n, m) => n + m.content.length, 0) > 12000)
    )
      throw new Error("Conversation is too long. Start a new session.");
    if (path === "image" && !data.prompt)
      throw new Error("Add an image prompt first.");
    ledger().reserve(
      data.requestId,
      owner,
      path!,
      path === "chat" ? 5 : path === "image" ? 35 : 50,
      Math.min(Number(process.env.APP_LIMIT_CENTS || 0), 1500),
    );
    if (path === "chat") {
      const r = await provider(
        "/v1/chat/completions",
        {
          model: models.chat,
          messages: [
            { role: "system", content: instructions },
            ...data.messages!,
          ],
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: 650,
          reasoning_effort: "none",
        },
        req.signal,
      );
      return new Response(r.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    }
    if (path === "image") {
      const r = await provider(
        "/v1/images/generations",
        {
          model: models.image,
          prompt: data.prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        },
        req.signal,
      );
      const d = await r.json();
      const item = d.data?.[0];
      if (!item?.b64_json)
        throw new Error(
          "No inline image returned. The request may have been charged; no retry was made.",
        );
      const b = String(item.b64_json);
      if (b.length > 18000000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(b))
        throw new Error("Image response could not be displayed.");
      return Response.json({
        image: `data:image/${b.startsWith("/9j/") ? "jpeg" : "png"};base64,${b}`,
        model: d.model || models.image,
        prompt: data.prompt,
      });
    }
    const r = await provider("/v1/voice/sessions", {
      system_prompt:
        instructions +
        " Keep spoken replies to two sentences. This call starts with fresh context.",
      llm_model: "sarvam-105b",
      stt_model: models.stt,
      tts_model: models.tts,
      tts_provider: "sarvam",
      voice: "shubh",
      language: data.language || "en-IN",
      max_duration_seconds: 60,
    });
    const d = await r.json();
    ledger().bind(data.requestId, d.id);
    return Response.json({
      id: d.id,
      wsUrl: d.ws_url,
      token: d.token,
      model: d.config?.llm_model || "sarvam-105b",
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Please check the request fields."
            : e instanceof Error
              ? e.message
              : "Request failed.",
      },
      { status: 400 },
    );
  }
}
