import sanitizeHtml from "sanitize-html";
import postcss from "postcss";
import { z } from "zod";
export const websiteSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(300),
  html: z.string().min(30).max(45000),
  css: z.string().max(30000),
  caption: z.string().max(1500),
  whatsapp: z.string().max(1500),
});
export type WebsiteContent = z.infer<typeof websiteSchema>;
export type WebsiteResult = {
  id: string;
  document: string;
  title: string;
  caption: string;
  whatsapp: string;
  model: string;
  usage?: number;
  publicPath?: string;
};
export const websiteCSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'; script-src 'none'; frame-src 'none'; object-src 'none'";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function websiteDocument(raw: unknown, image?: string) {
  const content = websiteSchema.parse(raw);
  const html = sanitizeHtml(content.html, {
    allowedTags: [
      "main",
      "header",
      "footer",
      "nav",
      "section",
      "article",
      "aside",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "a",
      "strong",
      "em",
      "small",
      "ul",
      "ol",
      "li",
      "br",
      "hr",
      "figure",
      "figcaption",
      "img",
      "blockquote",
    ],
    allowedAttributes: {
      "*": ["class", "id", "aria-label"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_t, a) => ({
        tagName: "a",
        attribs: { ...a, target: "_blank", rel: "noopener noreferrer" },
      }),
      img: (_t, a) => ({
        tagName: "img",
        attribs: {
          ...a,
          src:
            a.src === "{{CAMPAIGN_IMAGE}}" &&
            image &&
            /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image)
              ? image
              : "",
        },
      }),
    },
  });
  const css = postcss.parse(content.css);
  css.walkAtRules((r) => {
    if (!["media", "supports", "keyframes"].includes(r.name.toLowerCase()))
      r.remove();
  });
  css.walkDecls((d) => {
    if (
      /url\s*\(|expression\s*\(|javascript|behavior|\\|</i.test(d.value) ||
      /behavior|-moz-binding/i.test(d.prop)
    )
      d.remove();
  });
  const safeCSS = css.toString().replace(/</g, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${websiteCSP}"><meta name="description" content="${escape(content.description)}"><title>${escape(content.title)}</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}img{max-width:100%} ${safeCSS} @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style></head><body>${html}</body></html>`;
}
