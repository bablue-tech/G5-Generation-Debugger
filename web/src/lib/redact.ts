// Mirror of service/diagnostics/redact.py.

const PATTERNS: [RegExp, string][] = [
  [/\b(authorization|bearer)(\s*[:=]?\s*)[A-Za-z0-9._~+/=-]{8,}/gi, "$1$2[redacted]"],
  [/([?&](?:token|key|api_key|apikey|access_token|signature|sig|x-amz-[a-z-]+)=)[^&\s"'<>]+/gi, "$1[redacted]"],
  [/\b(?:sk|pk|rk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{12,}\b/g, "[redacted-key]"],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, "[redacted-key]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, "[redacted-token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]"],
];
const URL_RE = /https?:\/\/[^\s"'<>)]+/g;

function hostOnly(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}/…`;
  } catch {
    return "[link]";
  }
}

export function redact(text: string | null | undefined, limit = 400): string {
  if (!text) return "";
  let out = text;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  out = out.replace(URL_RE, hostOnly).split(/\s+/).filter(Boolean).join(" ");
  return out.length > limit ? out.slice(0, limit - 1) + "…" : out;
}
