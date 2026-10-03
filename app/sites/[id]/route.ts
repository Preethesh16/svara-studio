import { publicWebsite } from "@/lib/site-store";
import { websiteCSP } from "@/lib/website";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/.test(id))
    return new Response("Not found", { status: 404 });
  const document = publicWebsite(id);
  if (!document)
    return new Response("This page is not published.", { status: 404 });
  return new Response(document, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        websiteCSP + "; sandbox allow-popups allow-popups-to-escape-sandbox",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}
