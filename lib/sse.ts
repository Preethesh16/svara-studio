export class SSEDecoder {
  private pending = "";
  push(text: string) {
    this.pending += text.replace(/\r/g, "");
    const events: string[] = [];
    let i;
    while ((i = this.pending.indexOf("\n\n")) >= 0) {
      const chunk = this.pending.slice(0, i);
      this.pending = this.pending.slice(i + 2);
      const value = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (value) events.push(value);
    }
    return events;
  }
}
