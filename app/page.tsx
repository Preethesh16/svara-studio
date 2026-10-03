"use client";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import {
  AudioLines,
  ArrowUp,
  Plus,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  MicOff,
  PhoneOff,
  ChevronRight,
  Copy,
  Check,
  Download,
  Trash2,
  PanelLeft,
  Globe,
  ArrowUpRight,
  Sparkles,
  X,
  Square,
  Coffee,
  LockKeyhole,
} from "lucide-react";
import { WebsiteStudio } from "@/components/WebsiteStudio";
import { VoiceCommands, type VoiceKind } from "@/lib/voice-actions";
import type { WebsiteResult } from "@/lib/website";
import { readSSE } from "@/lib/sse";
import type { Room as RoomType } from "livekit-client";
type Message = {
  role: "user" | "assistant";
  content: string;
  source?: "voice";
};
type Session = {
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
const fresh = (): Session => ({
  id: crypto.randomUUID(),
  title: "Untitled session",
  messages: [],
  prompt: "",
  created: Date.now(),
});
const cafe =
  "Help my Bengaluru café launch a weekend offer. Let’s refine the audience, offer and tone, then draft an image prompt for me to approve.";
async function api(path: string, body: unknown, signal?: AbortSignal) {
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const d: any = await r.json();
    throw new Error(d.error || "Request failed.");
  }
  return r;
}
export default function Studio() {
  const [sessions, setSessions] = useState<Session[]>([]),
    [active, setActive] = useState(""),
    [ready, setReady] = useState(false);
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("chat"),
    [sidebar, setSidebar] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [voiceLimit, setVoiceLimit] = useState(180);
  const pendingVoice = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptSeen = useRef(new Set<string>());
  const [code, setCode] = useState(""),
    [unlocked, setUnlocked] = useState(false),
    [authChecked, setAuthChecked] = useState(false);
  const [language, setLanguage] = useState("en-IN"),
    [voice, setVoice] = useState("Ended"),
    [muted, setMuted] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const [usage, setUsage] = useState<number | null>(null),
    [latency, setLatency] = useState<number | null>(null),
    [copied, setCopied] = useState(-1),
    [remaining, setRemaining] = useState<number | null>(null);
  const operation = useRef(false),
    abort = useRef<AbortController | null>(null),
    room = useRef<RoomType | null>(null),
    voiceId = useRef(""),
    voiceEpoch = useRef(0),
    voiceLock = useRef(false),
    audio = useRef<HTMLMediaElement[]>([]),
    callStart = useRef(0),
    bottom = useRef<HTMLDivElement>(null);
  const session = sessions.find((s) => s.id === active);
  const update = (fn: (s: Session) => Session, id = active) =>
    setSessions((ss) => ss.map((s) => (s.id === id ? fn(s) : s)));
  async function refresh() {
    try {
      const r = await fetch("/api/status");
      if (r.ok) {
        const d: any = await r.json();
        setUnlocked(true);
        setRemaining(Math.max(0, d.limitCents - d.reservedCents));
      } else setUnlocked(false);
    } finally {
      setAuthChecked(true);
    }
  }
  useEffect(() => {
    let saved: Session[] = [];
    try {
      saved = JSON.parse(localStorage.getItem("svara-sessions") || "[]");
      if (
        !Array.isArray(saved) ||
        saved.some((s) => !s.id || !Array.isArray(s.messages))
      )
        saved = [];
    } catch {}
    if (!saved.length) saved = [fresh()];
    setSessions(saved);
    setActive(saved[0].id);
    setReady(true);
    void refresh();
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "svara-sessions",
          JSON.stringify(sessions.slice(0, 12)),
        );
      } catch {
        setNotice(
          "Browser storage is full. Download your image, then clear older sessions.",
        );
      }
  }, [sessions, ready]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant" });
  }, [session?.messages, busy]);
  useEffect(() => {
    const t = setInterval(() => {
      if (callStart.current)
        setElapsed(Math.floor((Date.now() - callStart.current) / 1000));
    }, 1000);
    const leave = () => {
      if (pendingVoice.current) clearTimeout(pendingVoice.current);
      voiceEpoch.current++;
      room.current?.localParticipant.audioTrackPublications.forEach((p) =>
        p.track?.stop(),
      );
      void room.current?.disconnect();
      audio.current.forEach((a) => a.remove());
      if (voiceId.current)
        navigator.sendBeacon(
          "/api/end",
          new Blob(
            [
              JSON.stringify({
                requestId: crypto.randomUUID(),
                id: voiceId.current,
              }),
            ],
            { type: "application/json" },
          ),
        );
    };
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (operation.current) return;
    operation.current = true;
    setError("");
    try {
      await api("login", { code });
      setCode("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
    }
  }
  async function chat() {
    if (!session || !text.trim() || operation.current) return;
    operation.current = true;
    const id = active;
    const started = performance.now();
    const messages: Message[] = [
      ...session.messages,
      { role: "user" as const, content: text.trim() },
    ];
    update((s) => ({
      ...s,
      title: s.messages.length ? s.title : text.trim().slice(0, 35),
      messages: [...messages, { role: "assistant", content: "" }],
    }));
    setText("");
    setBusy("chat");
    setError("");
    setUsage(null);
    setLatency(null);
    abort.current = new AbortController();
    let answer = "";
    let first = true;
    let done = false;
    try {
      const r = await api(
        "chat",
        {
          requestId: crypto.randomUUID(),
          messages: messages
            .filter((m) => m.source !== "voice")
            .slice(-12)
            .map(({ role, content }) => ({ role, content })),
        },
        abort.current.signal,
      );
      if (!r.body) throw new Error("The provider returned no response stream.");
      for await (const event of readSSE(r.body)) {
        if (event === "") continue;
        if (event === "[DONE]") {
          done = true;
          break;
        }
        const d = JSON.parse(event);
        if (d.error)
          throw new Error("The provider ended the response with an error.");
        const delta = d.choices?.[0]?.delta?.content;
        if (delta) {
          if (first) {
            setLatency(Math.round(performance.now() - started));
            first = false;
          }
          answer += delta;
          update(
            (s) => ({
              ...s,
              messages: [...messages, { role: "assistant", content: answer }],
            }),
            id,
          );
        }
        if (d.usage) setUsage(d.usage.total_tokens);
      }
      if (!done)
        throw new Error(
          "Connection ended before completion. The partial reply is preserved.",
        );
      if (!answer)
        throw new Error(
          "The model returned no visible text within the output limit.",
        );
    } catch (e) {
      if ((e as Error).name === "AbortError")
        setNotice("Generation stopped. Any partial response is preserved.");
      else setError((e as Error).message);
    } finally {
      setBusy("");
      operation.current = false;
      abort.current = null;
      void refresh();
    }
  }
  async function generate() {
    if (!session?.prompt.trim() || operation.current) return;
    operation.current = true;
    setBusy("image");
    setError("");
    const id = active;
    try {
      const d: any = await (
        await api("image", {
          requestId: crypto.randomUUID(),
          prompt: session.prompt,
        })
      ).json();
      update(
        (s) => ({
          ...s,
          image: d.image,
          imageModel: d.model,
          imagePrompt: d.prompt,
        }),
        id,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      operation.current = false;
      void refresh();
    }
  }
  async function endCall() {
    voiceEpoch.current++;
    const r = room.current;
    room.current = null;
    const id = voiceId.current;
    voiceId.current = "";
    callStart.current = 0;
    voiceLock.current = false;
    r?.localParticipant.audioTrackPublications.forEach((p) => p.track?.stop());
    try {
      await r?.disconnect();
    } catch {}
    audio.current.forEach((a) => {
      a.pause();
      a.srcObject = null;
      a.remove();
    });
    audio.current = [];
    setVoice("Ended");
    setMuted(false);
    if (id)
      try {
        await api("end", { requestId: crypto.randomUUID(), id });
      } catch {
        setError(
          "Audio stopped. Server hangup could not be confirmed; the provider’s bounded session limit still applies.",
        );
      }
    void refresh();
  }
  async function runVoiceAction(kind: VoiceKind, brief: string, target: string) {
    if (operation.current) { pendingVoice.current = setTimeout(() => void runVoiceAction(kind, brief, target), 500); return; }
    operation.current = true;
    setError("");
    const prompt = (`Create the requested ${kind === "image" ? "image" : "business website"} using these spoken requirements. Use sensible defaults, include the latest refinements, and do not invent business facts.\n` + brief).slice(0, kind === "image" ? 2000 : 4000);
    setBusy(kind);
    if (kind === "image") { setTab("canvas"); update(s => ({...s, prompt}), target); }
    else { update(s => ({...s, websiteBrief: prompt}), target); setSiteOpen(true); }
    update(s => ({...s,messages:[...s.messages,{role:"assistant",content:kind === "image" ? "Generating your image from your voice request…" : "Building your website from your voice request…"}]}),target);
    try {
      if (kind === "image") {
        const d = await (await api("image", {requestId:crypto.randomUUID(),prompt})).json() as {image:string;model:string;prompt:string};
        update(s => ({...s,image:d.image,imageModel:d.model,imagePrompt:d.prompt}),target);
      } else {
        const r = await fetch("/api/website",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"generate",requestId:crypto.randomUUID(),brief:prompt})});
        const d = await r.json() as WebsiteResult & {error?:string};
        if (!r.ok) throw new Error(d.error || "Website generation failed.");
        update(s => ({...s,website:d}),target);
      }
      const message = kind === "image" ? "Your image is ready in the canvas." : "Your website is ready in Website studio. Preview, download or publish it there.";
      setNotice(message);
      update(s => ({...s,messages:[...s.messages,{role:"assistant",content:message}]}),target);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      update(s => ({...s,messages:[...s.messages,{role:"assistant",content:`${kind === "image" ? "Image" : "Website"} generation failed: ${message}. Say “try again” for an explicit retry.`}]}),target);
    } finally { setBusy(""); operation.current=false; void refresh(); }
  }
  async function startCall() {
    if (voiceLock.current || !session) return;
    voiceLock.current = true;
    const epoch = ++voiceEpoch.current;
    const target = active;
    const commands = new VoiceCommands(siteOpen ? ["Build a website: " + (session.websiteBrief || session.prompt || "business website")] : session.messages.filter(m=>m.role === "user").map(m=>m.content));
    transcriptSeen.current.clear();
    setVoice("Connecting");
    setError("");
    setElapsed(0);
    let preflight: MediaStream | undefined;
    try {
      preflight = await navigator.mediaDevices.getUserMedia({ audio: true });
      preflight.getTracks().forEach((t) => t.stop());
      if (epoch !== voiceEpoch.current) return;
      const d: any = await (
        await api("voice", { requestId: crypto.randomUUID(), language })
      ).json();
      if (epoch !== voiceEpoch.current) {
        await api("end", { requestId: crypto.randomUUID(), id: d.id });
        return;
      }
      voiceId.current = d.id;
      setVoiceLimit(d.maxDurationSeconds || 180);
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const r = new Room();
      room.current = r;
      r.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const a = track.attach() as HTMLMediaElement;
          audio.current.push(a);
          document.body.appendChild(a);
          void a
            .play()
            .catch(() =>
              setNotice("Audio playback was blocked. Use Enable audio."),
            );
        }
      });
      r.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        for (const seg of segments) {
          if (!seg.final || transcriptSeen.current.has(seg.id)) continue;
          transcriptSeen.current.add(seg.id);
          const isUser = participant?.isLocal === true;
          update(
            (s) => ({
              ...s,
              messages: [
                ...s.messages,
                {
                  role: isUser ? "user" : "assistant",
                  content: seg.text,
                  source: "voice",
                },
              ],
            }),
            target,
          );
          const action = commands.accept(seg.id, seg.text, isUser);
          if (action) {
            if (pendingVoice.current) clearTimeout(pendingVoice.current);
            if (!action.cancel) {
              setNotice(`Starting your ${action.kind} from your voice request…`);
              pendingVoice.current = setTimeout(() => void runVoiceAction(action.kind, action.brief, target), 1500);
            } else setNotice("Queued voice generation cancelled. Any already-running request may still complete.");
          }
        }
      });
      r.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (epoch === voiceEpoch.current)
          setVoice(
            speakers.some((p) => !p.isLocal) ? "Responding" : "Listening",
          );
      });
      r.on(RoomEvent.Reconnecting, () => setVoice("Reconnecting"));
      r.on(RoomEvent.Reconnected, () => setVoice("Listening"));
      r.on(RoomEvent.Disconnected, () => {
        if (epoch === voiceEpoch.current) {
          setNotice("Voice ended. You can continue in text.");
          void endCall();
        }
      });
      await r.connect(d.wsUrl, d.token);
      if (epoch !== voiceEpoch.current) {
        await r.disconnect();
        return;
      }
      await r.localParticipant.setMicrophoneEnabled(true);
      callStart.current = Date.now();
      setVoice("Listening");
      setTimeout(() => {
        if (epoch === voiceEpoch.current) void endCall();
      }, (d.maxDurationSeconds || 180) * 1000);
    } catch (e) {
      preflight?.getTracks().forEach((t) => t.stop());
      await endCall();
      setError(
        (e as Error).name === "NotAllowedError"
          ? "Microphone permission was denied. You can continue in text."
          : (e as Error).message ||
              "Voice could not connect. Continue in text.",
      );
    }
  }
  async function toggleMute() {
    try {
      await room.current?.localParticipant.setMicrophoneEnabled(muted);
      setMuted(!muted);
    } catch {
      setError("Microphone could not be changed. End the call and reconnect.");
    }
  }
  function newSession() {
    if (busy || voiceLock.current) return;
    const s = fresh();
    setSessions((ss) => [s, ...ss].slice(0, 12));
    setActive(s.id);
    setSidebar(false);
    setError("");
    setUsage(null);
    setLatency(null);
  }
  const callActive = voice !== "Ended";
  return (
    <div className="studio">
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a href="/" className="brand">
          <span className="brand-icon">
            <AudioLines size={23} />
          </span>
          <span>
            Svara<span className="brand-light"> Studio</span>
          </span>
        </a>
        <div className="workspace-label">YOUR NEXT BIG LOCAL IDEA</div>
        <button
          className="new-session"
          onClick={newSession}
          disabled={!!busy || callActive}
        >
          <Plus size={17} /> New session <span>↗</span>
        </button>
        <div className="nav-label">RECENT SESSIONS</div>
        <nav>
          {sessions.map((s) => (
            <button
              key={s.id}
              className={`session-link ${s.id === active ? "selected" : ""}`}
              disabled={!!busy || callActive}
              onClick={() => {
                setActive(s.id);
                setSidebar(false);
              }}
            >
              <MessageSquare size={16} />
              <span>{s.title}</span>
            </button>
          ))}
        </nav>
        <div className="scenario">
          <span className="small-icon">
            <Coffee size={19} />
          </span>
          <h3>A little inspiration</h3>
          <p>From your first idea to a weekend worth talking about.</p>
          <button
            onClick={() => {
              setText(cafe);
              setTab("chat");
              setSidebar(false);
            }}
          >
            Launch a café offer <ChevronRight size={15} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">P</span>
          <div>
            <strong>Campaign workspace</strong>
            <small>Saved on this browser</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="header-title">
            <button
              className="mobile-menu icon-btn"
              aria-label="Open sessions"
              onClick={() => setSidebar(!sidebar)}
            >
              <PanelLeft size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} />
            </span>
            <strong>{session?.title || "Your next idea"}</strong>
          </div>
          <span className="provider">
            <span /> Voice + images by CallMissed
          </span>
        </header>
        <div className="mobile-tabs">
          <button
            className={tab === "chat" ? "active" : ""}
            onClick={() => setTab("chat")}
          >
            <MessageSquare size={15} /> Conversation
          </button>
          <button
            className={tab === "canvas" ? "active" : ""}
            onClick={() => setTab("canvas")}
          >
            <ImageIcon size={15} /> Canvas
          </button>
        </div>
        <div className="campaign-ribbon">
          <span className={session?.messages.length ? "complete" : ""}>
            <span>01</span> Talk it through
          </span>
          <ChevronRight size={13} />
          <span className={session?.image ? "complete" : ""}>
            <span>02</span> Create your poster
          </span>
          <ChevronRight size={13} />
          <button onClick={() => setSiteOpen(true)}>
            <span>03</span> Build your website <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="workarea">
          <section
            className={`conversation ${tab === "chat" ? "mobile-active" : ""}`}
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">SPEAK IT. SHAPE IT. SHARE IT.</span>
                <h1>Your next customer starts here.</h1>
              </div>
              <button
                className="icon-btn"
                aria-label="Clear current conversation"
                disabled={!!busy || callActive}
                onClick={() => {
                  update((s) => ({
                    ...s,
                    messages: [],
                    title: "Untitled session",
                  }));
                  setNotice("Conversation cleared from this browser.");
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
            <div className="messages">
              {!session?.messages.length ? (
                <div className="empty">
                  <div className="wave-emblem">
                    <AudioLines size={37} strokeWidth={1.4} />
                  </div>
                  <h2>
                    Big things start
                    <br />
                    with a local idea.
                  </h2>
                  <p>
                    Speak your next offer. Create the poster. Give it
                    <br className="desktop-break" /> a place on the web.
                  </p>
                  <div className="suggestions">
                    <button onClick={() => setText(cafe)}>
                      <Coffee size={18} />
                      <span>
                        Launch a café offer
                        <small>A weekend campaign, from scratch</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setText(
                          "मेरे छोटे व्यवसाय के लिए एक नया प्रचार विचार सोचने में मदद करें।",
                        )
                      }
                    >
                      <MessageSquare size={18} />
                      <span>
                        सोचें, अपनी भाषा में
                        <small>Brainstorm in Hindi or English</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                session.messages.map((m, i) => (
                  <article key={i} className={`message ${m.role}`}>
                    <div className="message-label">
                      {m.role === "user" ? "YOU" : "SVARA"}
                      {m.source === "voice" && <span> · Voice</span>}
                    </div>
                    <Markdown
                      components={{
                        img: () => <span>[External image omitted]</span>,
                        a: ({ children, href }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {m.content ||
                        (busy === "chat" ? "Thinking…" : "No text received.")}
                    </Markdown>
                    {m.content && (
                      <div className="message-actions">
                        <button
                          aria-label="Copy message"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(m.content);
                              setCopied(i);
                              setTimeout(() => setCopied(-1), 1800);
                            } catch {
                              setNotice("Copy is unavailable in this browser.");
                            }
                          }}
                        >
                          {copied === i ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                        {m.role === "assistant" && (
                          <button
                            onClick={() => {
                              update((s) => ({
                                ...s,
                                prompt: m.content.slice(0, 2000),
                              }));
                              setTab("canvas");
                              setNotice(
                                "Draft copied to the canvas. Edit and approve it before generating.",
                              );
                            }}
                          >
                            Use as image brief <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ))
              )}
              <div ref={bottom} />
            </div>
            <div className="conversation-bottom">
              {error && (
                <div className="feedback error" role="alert">
                  {error}
                  <button
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {notice && (
                <div className="feedback" role="status">
                  {notice}
                  <button
                    aria-label="Dismiss notice"
                    onClick={() => setNotice("")}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="voice-strip">
                <span className={`voice-icon ${callActive ? "on" : ""}`}>
                  <AudioLines size={20} />
                </span>
                <div>
                  <strong>
                    {callActive
                      ? muted
                        ? "Muted"
                        : voice
                      : "Prefer to talk it through?"}
                  </strong>
                  <small>
                    {callActive
                      ? `${elapsed}s / ${voiceLimit}s · Voice commands generate automatically`
                      : "Ask by voice to create images or websites · up to 3 minutes"}
                  </small>
                </div>
                <select
                  aria-label="Voice language"
                  value={language}
                  disabled={callActive}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">हिन्दी</option>
                </select>
                {callActive ? (
                  <>
                    <button
                      className="icon-btn"
                      aria-label={
                        muted ? "Unmute microphone" : "Mute microphone"
                      }
                      onClick={toggleMute}
                    >
                      {muted ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                      className="end-call icon-btn"
                      aria-label="End voice call"
                      onClick={() => void endCall()}
                    >
                      <PhoneOff size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    className="voice-start"
                    disabled={!unlocked}
                    onClick={() => void startCall()}
                  >
                    <Mic size={15} />
                    <span>Start voice</span>
                  </button>
                )}
              </div>
              {callActive && (
                <button
                  className="text-btn"
                  onClick={() => {
                    void room.current?.startAudio();
                    audio.current.forEach((a) => void a.play());
                  }}
                >
                  Enable audio
                </button>
              )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void chat();
                }}
              >
                <textarea
                  aria-label="Message Svara"
                  placeholder="What’s on your mind?"
                  maxLength={4000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void chat();
                    }
                  }}
                />
                <div>
                  <span>
                    <Sparkles size={13} /> Gemma 4 26B
                  </span>
                  {busy === "chat" ? (
                    <button
                      type="button"
                      className="send"
                      aria-label="Stop generation"
                      onClick={() => abort.current?.abort()}
                    >
                      <Square size={16} />
                    </button>
                  ) : (
                    <button
                      className="send"
                      aria-label="Send message"
                      disabled={!text.trim() || !!busy || !unlocked}
                    >
                      <ArrowUp size={19} />
                    </button>
                  )}
                </div>
              </form>
              <p className="composer-note">
                English or हिन्दी · Enter to send · AI can make mistakes
              </p>
            </div>
          </section>
          <aside
            className={`canvas-panel ${tab === "canvas" ? "mobile-active" : ""}`}
          >
            {tab === "canvas" && error && (
              <div className="feedback error" role="alert">
                {error}
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="canvas-heading">
              <span>
                <ImageIcon size={18} /> Creative canvas
              </span>
              <span className="badge">IMAGE</span>
            </div>
            <p className="muted-text">
              Give your conversation a visual direction.
            </p>
            <div className={`canvas ${session?.image ? "has-image" : ""}`}>
              {session?.image ? (
                <img
                  src={session.image}
                  alt={session.imagePrompt || "Generated creative"}
                />
              ) : (
                <>
                  <div className="canvas-corners" />
                  <ImageIcon size={30} strokeWidth={1.1} />
                  <strong>Your next creation lives here</strong>
                  <span>One prompt. A new possibility.</span>
                </>
              )}
            </div>
            {session?.image && (
              <a
                className="download"
                download="svara-creative.png"
                href={session.image}
              >
                <Download size={15} /> Download image
              </a>
            )}
            <label className="field-label" htmlFor="brief">
              Your creative brief <span>EDITABLE</span>
            </label>
            <textarea
              id="brief"
              className="brief"
              placeholder="Describe the image you have in mind. Include the subject, mood, colors and any text…"
              maxLength={2000}
              value={session?.prompt || ""}
              onChange={(e) =>
                update((s) => ({ ...s, prompt: e.target.value }))
              }
            />
            <div className="style-label">TRY A DIRECTION</div>
            <div className="style-chips">
              {["Minimal editorial", "Warm & organic", "Bold typography"].map(
                (style) => (
                  <button
                    key={style}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        prompt: (s.prompt + "\nStyle: " + style + ".").slice(
                          0,
                          2000,
                        ),
                      }))
                    }
                  >
                    {style}
                  </button>
                ),
              )}
            </div>
            <div className="image-config">
              <span>GPT Image 2</span>
              <span>1024 × 1024</span>
            </div>
            <button
              className="generate"
              disabled={!session?.prompt.trim() || !!busy || !unlocked}
              onClick={() => void generate()}
            >
              <Sparkles size={16} />
              {busy === "image"
                ? "Creating your image…"
                : "Approve & generate image"}
            </button>
            <p className="cost-note">
              Est. $0.2604 · 1 image · Click or ask by voice to generate
            </p>
            <details className="details">
              <summary>
                Session details <Plus size={14} />
              </summary>
              <dl>
                <dt>Chat model</dt>
                <dd>Gemma 4 26B</dd>
                <dt>Image model</dt>
                <dd>{session?.imageModel || "GPT Image 2 (selected)"}</dd>
                <dt>Voice pipeline</dt>
                <dd>Saaras v3 → Sarvam → Bulbul v3</dd>
                <dt>Client-observed first text</dt>
                <dd>{latency === null ? "Not measured" : `${latency} ms`}</dd>
                <dt>Last chat tokens</dt>
                <dd>{usage ?? "Not reported"}</dd>
                <dt>App allowance left</dt>
                <dd>
                  {remaining === null
                    ? "Sign in to view"
                    : `$${(remaining / 100).toFixed(2)} (reservations)`}
                </dd>
              </dl>
              <p>
                Transcripts and images stay in this browser. Audio is not
                recorded by this app. CallMissed processes audio and may store
                transcripts. Voice begins with fresh context; copy its
                transcript into chat for an explicit handoff.
              </p>
              <button
                className="text-btn"
                disabled={!!busy || callActive}
                onClick={() => {
                  const s = fresh();
                  setSessions([s]);
                  setActive(s.id);
                  localStorage.removeItem("svara-sessions");
                }}
              >
                Clear all local sessions
              </button>
            </details>
            <button
              className="website-launch"
              disabled={!unlocked}
              onClick={() => setSiteOpen(true)}
            >
              <span className="website-launch-icon">
                <Globe size={22} />
              </span>
              <span>
                <strong>Give your idea a home.</strong>
                <small>Build a custom business website</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
            <div className="canvas-footer">
              <LockKeyhole size={13} /> Your API key stays on the server.
            </div>
          </aside>
        </div>
      </main>
      {siteOpen && session && (
        <WebsiteStudio
          voice={{active:callActive,state:voice,elapsed,limit:voiceLimit,muted,language,transcript:session.messages.filter(m=>m.source === "voice" && m.role === "user").at(-1)?.content || "",start:()=>void startCall(),end:()=>void endCall(),mute:()=>void toggleMute(),setLanguage}}
          externalError={error}
          externalBusy={busy === "website"}
          onBusy={(value) => { operation.current = value; }}
          brief={session.websiteBrief ?? session.prompt ?? ""}
          image={session.image}
          result={session.website}
          onBrief={(websiteBrief) => update((s) => ({ ...s, websiteBrief }))}
          onResult={(website) => update((s) => ({ ...s, website }))}
          onClose={() => setSiteOpen(false)}
        />
      )}
      {authChecked && !unlocked && (
        <div className="access-overlay">
          <form
            className="access-card"
            role="dialog"
            aria-modal="true"
            aria-label="Reviewer access"
            onSubmit={login}
          >
            <span className="brand-icon">
              <AudioLines size={26} />
            </span>
            <span className="eyebrow">WELCOME TO SVARA STUDIO</span>
            <h2>A space for your next idea.</h2>
            <p>
              Enter your reviewer access code to try chat, images and voice.
            </p>
            <label htmlFor="code">Reviewer access code</label>
            <input
              id="code"
              autoFocus
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button className="generate">
              Open workspace <ChevronRight size={16} />
            </button>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <small>CallMissed voice & images · OpenAI websites</small>
          </form>
        </div>
      )}
    </div>
  );
}
