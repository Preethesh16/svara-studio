// Recognize explicit creative requests in English, Hindi and common Hinglish.
export function voiceDraftIntent(text: string): "image" | "website" | null {
  if (/\b(don['’]?t|do not|never|stop)\b|मत\s|नहीं.*बना/i.test(text))
    return null;
  const asks =
    /\b(generate|create|make|build|design|draw|want|need|banao|bana|banake|chahiye)\b|बना|चाहिए|तैयार|बनाओ/i.test(
      text,
    );
  if (!asks) return null;
  if (
    /\b(website|web\s*page|landing\s*page|site)\b|वेबसाइट|वेब\s*पेज/i.test(text)
  )
    return "website";
  if (
    /\b(image|poster|picture|graphic|artwork|banner|photo|tasveer)\b|पोस्टर|तस्वीर|चित्र|इमेज|बैनर/i.test(
      text,
    )
  )
    return "image";
  return null;
}
