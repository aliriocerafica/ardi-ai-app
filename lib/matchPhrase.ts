export function containsPhrase(haystack: string, needle: string): boolean {
  const phrase = needle.toLowerCase().trim();
  if (!phrase) return false;
  const text = haystack.toLowerCase();
  if (/\s/.test(phrase)) return text.includes(phrase);
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

export function isStandaloneGreeting(message: string): boolean {
  const text = message
    .toLowerCase()
    .replace(/[?.!,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(hi|hello|hey|yo|sup|greetings|good morning|good afternoon|good evening)( there)?( ardi)?$/.test(text);
}
