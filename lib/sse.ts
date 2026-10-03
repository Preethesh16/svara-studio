/** Data-only SSE framing for provider streams (no reconnect or event-ID state). */
export class SSEDecoder {
  private line = "";
  private data: string[] = [];
  private dataLength = 0;
  private skipLF = false;
  private initial = true;
  private failed = false;

  constructor(private readonly maximumCharacters = 256 * 1024) {
    if (!Number.isSafeInteger(maximumCharacters) || maximumCharacters < 1)
      throw new RangeError("The event size limit must be a positive integer.");
  }

  push(text: string): string[] {
    return [...this.decode(text)];
  }

  *decode(text: string): Generator<string> {
    if (this.failed) throw new Error("The event stream decoder is no longer usable.");
    for (const character of text) {
      if (this.initial) {
        this.initial = false;
        if (character === "\ufeff") continue;
      }
      if (this.skipLF) {
        this.skipLF = false;
        if (character === "\n") continue;
      }
      if (character === "\r" || character === "\n") {
        const event = this.finishLine();
        this.skipLF = character === "\r";
        if (event !== undefined) yield event;
      } else {
        this.line += character;
        if (this.line.length + this.dataLength > this.maximumCharacters) {
          this.failed = true;
          this.line = "";
          this.data = [];
          this.dataLength = 0;
          throw new Error("The provider sent an event that is too large. The partial reply is preserved.");
        }
      }
    }
  }

  private finishLine(): string | undefined {
    const line = this.line;
    this.line = "";
    if (line === "") {
      const event = this.data.length ? this.data.join("\n") : undefined;
      this.data = [];
      this.dataLength = 0;
      return event;
    }
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    if (field !== "data") return;
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    this.data.push(value);
    this.dataLength += value.length + 1;
  }
}

/** Release the body on completion, early consumer exit, or a parsing failure. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  // The framing decoder, rather than TextDecoder, strips exactly one BOM.
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  const parser = new SSEDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        yield* parser.decode(decoder.decode());
        return; // An event without a final blank line is deliberately discarded.
      }
      yield* parser.decode(decoder.decode(value, { stream: true }));
    }
  } finally {
    try { await reader.cancel(); } catch { /* Preserve the original stream error. */ }
    reader.releaseLock();
  }
}
