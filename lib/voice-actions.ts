import { voiceDraftIntent } from './voice-draft';
export type VoiceKind = 'image' | 'website';
export class VoiceCommands {
  private seen = new Set<string>();
  private turns: string[] = [];
  private kind: VoiceKind | null = null;
  private lastText = '';
  private lastAt = 0;
  private requested = '';
  constructor(history: string[] = []) { this.turns = history.slice(-12); for (const t of this.turns) this.kind = voiceDraftIntent(t) || this.kind; }
  accept(id: string, text: string, isUser: boolean, now = Date.now()) {
    if (!isUser || !text.trim() || this.seen.has(id)) return null;
    this.seen.add(id);
    const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (normalized === this.lastText && now - this.lastAt < 5000) return null;
    this.lastText = normalized; this.lastAt = now;
    if (/\b(don['’]?t|do not|never|stop|cancel|mat|nahi)\b|मत|नहीं/i.test(text)) return {cancel:true as const};
    const direct = voiceDraftIntent(text);
    const follow = /\b(do it|go ahead|start now|do that|build it|generate it|make it|change|update|refine|redesign|kar do|kardo|bana do|banao|abhi|jaldi)\b|कर दो|बना दो|बनाओ|अभी|जल्दी/i.test(text);
    const retry = /\b(again|retry|try again|dobara|phir)\b|दोबारा|फिर/i.test(text);
    if (!follow || direct || /change|update|refine|redesign|make it/i.test(text)) this.turns = [...this.turns, text].slice(-12);
    if (direct) this.kind = direct;
    if (!this.kind || (!direct && !follow && !retry)) return null;
    const brief = this.turns.join('\n');
    const key = this.kind + ':' + brief;
    if (key === this.requested && !retry) return null;
    this.requested = key;
    return {cancel:false as const,kind:this.kind,brief};
  }
}
