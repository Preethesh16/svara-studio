import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function sign(s: string) {
  if (!process.env.SESSION_SECRET) throw new Error("Session secret missing.");
  return createHmac("sha256", process.env.SESSION_SECRET)
    .update(s)
    .digest("hex");
}
export function issue() {
  const s = `${randomUUID()}.${Date.now() + 86400000}`;
  return `${s}.${sign(s)}`;
}
export function identity(req: Request) {
  const token =
    req.headers
      .get("cookie")
      ?.split("; ")
      .find((x) => x.startsWith("svara="))
      ?.slice(6) || "";
  const [id, expiry, sig] = token.split(".");
  if (
    !id ||
    !expiry ||
    !sig ||
    Number(expiry) < Date.now() ||
    !equal(sig, sign(`${id}.${expiry}`))
  )
    throw new Error("Enter the reviewer access code to continue.");
  return id;
}
