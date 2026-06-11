export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

/** Pretty-print if the string is JSON; otherwise return it unchanged. */
export function prettyMaybe(s: string): { text: string; isJson: boolean } {
  try {
    return { text: JSON.stringify(JSON.parse(s), null, 2), isJson: true };
  } catch {
    return { text: s, isJson: false };
  }
}

/** Lightweight JSON syntax highlight → HTML using the .jkey/.jstr/... classes. */
export function highlightJson(json: string): string {
  return escapeHtml(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+\.?\d*([eE][+-]?\d+)?)/g,
    (m) => {
      let cls = 'jnum';
      if (/^"/.test(m)) cls = /:$/.test(m) ? 'jkey' : 'jstr';
      else if (/true|false/.test(m)) cls = 'jbool';
      else if (/null/.test(m)) cls = 'jnull';
      return `<span class="${cls}">${m}</span>`;
    },
  );
}

export function fmtUptime(s: number): string {
  s = Math.floor(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
