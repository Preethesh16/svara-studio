"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Globe,
  LoaderCircle,
  Monitor,
  Smartphone,
  Sparkles,
  X,
  Undo2,
  Mic, MicOff, PhoneOff,
} from "lucide-react";
import type { WebsiteResult } from "@/lib/website";
type Props = {
  voice?: {active:boolean; state:string; elapsed:number; limit:number; muted:boolean; language:string; transcript:string; start:()=>void; end:()=>void; mute:()=>void; setLanguage:(s:string)=>void};
  externalError?: string;
  externalBusy?: boolean;
  onBusy?: (busy: boolean) => void;
  brief: string;
  image?: string;
  result?: WebsiteResult;
  onBrief: (s: string) => void;
  onResult: (r: WebsiteResult) => void;
  onClose: () => void;
};
export function WebsiteStudio({
  voice,
  externalError = "",
  externalBusy = false,
  onBusy,
  brief,
  image,
  result,
  onBrief,
  onResult,
  onClose,
}: Props) {
  const [localBusy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [mobile, setMobile] = useState(false),
    [copy, setCopy] = useState(""),
    [embed, setEmbed] = useState(true),
    [autoPublish, setAutoPublish] = useState(false);
  const busy = externalBusy ? "generate" : localBusy;
  const lock = useRef(false),
    dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void fetch("/api/website")
      .then((r) => r.json() as Promise<{enabled?: boolean}>)
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
    const old = document.activeElement as HTMLElement;
    dialog.current?.focus();
    return () => old?.focus();
  }, []);
  async function send(body: unknown) {
    const r = await fetch("/api/website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d: any = await r.json();
    if (!r.ok) throw new Error(d.error || "Website request failed.");
    return d;
  }
  async function generate() {
    if (lock.current || externalBusy) return;
    lock.current = true;
    onBusy?.(true);
    setBusy("generate");
    setError("");
    try {
      const d: WebsiteResult = await send({
        action: "generate",
        requestId: crypto.randomUUID(),
        brief,
        image: embed ? image : undefined,
      });
      onResult(d);
      if (autoPublish) {
        setBusy("publish");
        const publication: any = await send({
          action: "publish",
          id: d.id,
          publish: true,
        });
        onResult({ ...d, publicPath: publication.publicPath });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      lock.current = false;
      onBusy?.(false);
    }
  }
  async function publish() {
    if (!result || lock.current || externalBusy) return;
    lock.current = true;
    onBusy?.(true);
    setBusy("publish");
    setError("");
    try {
      const d: any = await send({
        action: "publish",
        id: result.id,
        publish: !result.publicPath,
      });
      onResult({ ...result, publicPath: d.publicPath || undefined });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      lock.current = false;
      onBusy?.(false);
    }
  }
  async function clipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopy(key);
      setTimeout(() => setCopy(""), 1800);
    } catch {
      setError("Clipboard is unavailable. Select and copy the text below.");
    }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([result.document], { type: "text/html" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-business-website.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function keyboard(e: React.KeyboardEvent) {
    if (e.key === "Escape" && !busy) onClose();
    if (e.key === "Tab") {
      const els = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea, input, a[href], [tabindex="0"]',
        ) || [],
      );
      const first = els[0],
        last = els[els.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  return (
    <div className="site-overlay">
      <div
        className="site-studio"
        role="dialog"
        aria-modal="true"
        aria-label="Business website studio"
        tabIndex={-1}
        ref={dialog}
        onKeyDown={keyboard}
      >
        <div className="site-top">
          <div>
            <span className="eyebrow">FROM A LOCAL IDEA TO AN ONLINE HOME</span>
            <h2>
              <Globe size={23} /> Your business, on the web.
            </h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Close website studio"
            disabled={!!busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="site-layout">
          <section className="site-controls">
            <span className="step-label">01 / THE BRIEF</span>
            <h3>
              Tell your story.
              <br />
              We’ll build around it.
            </h3>
            <p>
              Describe your business, your customers and the feeling you want.
              Add only the contact details you want visitors to see.
            </p>
            {voice && <div className="site-voice" aria-label="Website voice agent">
              <strong><Mic size={17}/>{voice.active ? (voice.muted ? "Muted" : voice.state) : "Tell Svara what to build"}</strong>
              <p>Say “build a website for my vegetable shop” or “make it green”. Your request starts automatically.</p>
              <div className="site-voice-buttons">
                <select aria-label="Website voice language" disabled={voice.active} value={voice.language} onChange={e=>voice.setLanguage(e.target.value)}><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option></select>
                {voice.active ? <><button onClick={voice.mute} aria-label={voice.muted ? "Unmute website microphone" : "Mute website microphone"}>{voice.muted ? <MicOff size={16}/> : <Mic size={16}/>}</button><button onClick={voice.end}><PhoneOff size={16}/> End voice</button></> : <button onClick={voice.start}> <Mic size={16}/> Talk to build</button>}
              </div>
              {voice.active && <small>{voice.elapsed}s / {voice.limit}s · Voice commands create automatically</small>}
              {voice.transcript && <p className="site-voice-transcript" aria-live="polite">You: {voice.transcript}</p>}
            </div>}
            {externalError && <p role="alert" className="error-text">{externalError}</p>}
            <label htmlFor="website-brief">
              What should your website be like?
            </label>
            <textarea
              id="website-brief"
              maxLength={4000}
              value={brief}
              onChange={(e) => onBrief(e.target.value)}
              placeholder="A playful website for my Bengaluru bakery. Showcase sourdough and weekend brunch. Warm colors, big type, an about section…"
            />
            <div className="site-presets">
              {["Neighborhood café", "Home bakery", "Creative salon"].map(
                (name, i) => (
                  <button
                    key={name}
                    onClick={() =>
                      onBrief(
                        [
                          `Build a welcoming website for my neighborhood café. Use warm cream and espresso tones, editorial typography, a menu section and space for my address. Do not invent contact details.`,
                          `Build a playful website for my home bakery. Showcase handmade cakes and weekend specials with a soft peach palette and bold typography. Leave unknown prices and contact details out.`,
                          `Build an expressive website for my creative salon. Use confident typography, violet accents and a services section. Add booking contact details only after I provide them.`,
                        ][i],
                      )
                    }
                  >
                    {name}
                  </button>
                ),
              )}
            </div>
            {image && (
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={embed}
                  onChange={(e) => setEmbed(e.target.checked)}
                />{" "}
                Include my campaign poster
              </label>
            )}
            <label className="check-line">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
              />{" "}
              Publish automatically when generation finishes
            </label>
            <small className="publish-explanation">
              Publishing creates a page within this Site’s current audience. Private Site access still applies.
            </small>
            <button
              className="generate"
              disabled={!!busy || brief.trim().length < 20 || enabled !== true}
              onClick={() => void generate()}
            >
              {busy === "generate" ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}{" "}
              {busy === "generate"
                ? "Designing your website…"
                : "Build my website"}
            </button>
            <p className="site-cost">
              OpenAI · GPT-4.1 mini · $0.10 reserved per request
              <br />
              Separate from your CallMissed allowance
            </p>
            {enabled === false && (
              <div className="setup-note">
                <strong>Website generation is paused</strong>
                <span>
                  Your brief is saved. Website generation becomes available when
                  the server key and separate allowance are configured.
                </span>
              </div>
            )}
            {error && (
              <div className="feedback error" role="alert">
                {error}
              </div>
            )}
          </section>
          <section className="site-output">
            <div className="preview-toolbar">
              <span>{result ? "02 / YOUR WEBSITE" : "02 / LIVE PREVIEW"}</span>
              <div>
                <button
                  aria-label="Desktop website preview"
                  aria-pressed={!mobile}
                  onClick={() => setMobile(false)}
                >
                  <Monitor size={16} />
                </button>
                <button
                  aria-label="Mobile website preview"
                  aria-pressed={mobile}
                  onClick={() => setMobile(true)}
                >
                  <Smartphone size={16} />
                </button>
              </div>
            </div>
            <div className={`website-preview ${mobile ? "phone-preview" : ""}`}>
              {result ? (
                <iframe
                  title="Generated business website preview"
                  sandbox=""
                  srcDoc={result.document}
                />
              ) : (
                <div className="website-placeholder">
                  <div className="blueprint">
                    <div />
                    <div />
                    <div />
                    <div />
                  </div>
                  <span className="eyebrow">BUILT FROM YOUR BRIEF</span>
                  <h3>
                    A little business.
                    <br />A big first impression.
                  </h3>
                  <p>
                    Your custom website will appear here.
                    <br />
                    Preview it on desktop and mobile before sharing.
                  </p>
                </div>
              )}
              {busy === "generate" && (
                <div className="building-overlay" role="status">
                  <LoaderCircle className="spin" size={28} />
                  <strong>Turning your story into a website</strong>
                  <span>
                    Writing the page, designing the layout, preparing your copy.
                  </span>
                </div>
              )}
            </div>
            {result && (
              <>
                <div className="website-actions">
                  <strong>{result.title}</strong>
                  <button onClick={download}>
                    <Download size={15} /> Download HTML
                  </button>
                  <button disabled={!!busy} onClick={() => void publish()}>
                    {result.publicPath ? (
                      <Undo2 size={15} />
                    ) : (
                      <Globe size={15} />
                    )}{" "}
                    {result.publicPath ? "Unpublish" : "Publish page"}
                  </button>
                </div>
                {result.publicPath && (
                  <div className="published-link">
                    <a
                      href={result.publicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open published page <ArrowUpRight size={14} />
                    </a>
                    <button
                      onClick={() =>
                        void clipboard(
                          location.origin + result.publicPath,
                          "link",
                        )
                      }
                    >
                      {copy === "link" ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}{" "}
                      Copy link
                    </button>
                  </div>
                )}
                <div className="copy-kit">
                  {[
                    ["caption", "Social caption", result.caption],
                    ["whatsapp", "WhatsApp copy", result.whatsapp],
                  ].map(([key, title, value]) => (
                    <article key={key}>
                      <div>
                        <h4>{title}</h4>
                        <button
                          aria-label={`Copy ${title}`}
                          onClick={() => void clipboard(value, key)}
                        >
                          {copy === key ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                      <p>{value}</p>
                    </article>
                  ))}
                </div>
                <p className="site-result-note">
                  Generated with {result.model}{" "}
                  {result.usage
                    ? `· ${result.usage} provider-reported tokens`
                    : ""}{" "}
                  · Review business details before sharing.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
