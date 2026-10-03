import { z } from "zod";
import { identity } from "@/lib/auth";
import { generateWebsite, websiteEnabled } from "@/lib/openai-website";
import { websiteDocument } from "@/lib/website";
import { publishWebsite, saveWebsite } from "@/lib/site-store";
export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    requestId: z.string().uuid(),
    brief: z.string().min(20).max(4000),
    image: z
      .string()
      .max(5500000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
      .optional(),
  }),
  z.object({
    action: z.literal("publish"),
    id: z.string().uuid(),
    publish: z.boolean(),
  }),
]);
export async function GET(req: Request) {
  try {
    identity(req);
    return Response.json(
      { enabled: websiteEnabled() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Reviewer access required." },
      { status: 401 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const owner = identity(req);
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return Response.json({ error: "Origin refused." }, { status: 403 });
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    const reader = req.body?.getReader();
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 5600000) {
          await reader.cancel();
          return Response.json(
            {
              error:
                "The poster is too large to embed. Generate the website without it.",
            },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    const input = schema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (input.action === "publish") {
      if (!await publishWebsite(input.id, owner, input.publish))
        return Response.json(
          { error: "Website not found for this reviewer session." },
          { status: 404 },
        );
      return Response.json({
        publicPath: input.publish ? `/sites/${input.id}` : null,
      });
    }
    const d = await generateWebsite(
      input.brief,
      input.requestId,
      owner,
      req.signal,
    );
    const document = websiteDocument(d.content, input.image);
    await saveWebsite(input.requestId, owner, document);
    return Response.json({
      id: input.requestId,
      document,
      title: d.content.title,
      caption: d.content.caption,
      whatsapp: d.content.whatsapp,
      model: d.model,
      usage: d.usage,
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "The website request or generated content did not pass validation."
            : e instanceof Error
              ? e.message
              : "Website generation failed.",
      },
      { status: 400 },
    );
  }
}
