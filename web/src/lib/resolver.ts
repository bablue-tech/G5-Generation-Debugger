// Mirror of service/diagnostics/resolver.py. The link is parsed, never fetched.

export const ALLOWED_HOSTS = new Set(["aistudio.galleri5.com"]);
const MAX_LENGTH = 2048;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const JOB_ID = /^jr-[A-Za-z0-9-]{4,64}$/;
const GENERATION_PATH = /^\/generations\/([^/]+)\/?$/;

export type Reference = { kind: "inference" | "session" | "job"; id: string };

export class ReferenceError extends Error {}

function checked(kind: Reference["kind"], id: string): Reference {
  if (!OBJECT_ID.test(id)) throw new ReferenceError("The ID in this link doesn't look valid.");
  return { kind, id: id.toLowerCase() };
}

export function parseReference(raw: string | null | undefined): Reference {
  const value = (raw ?? "").trim();
  if (!value) throw new ReferenceError("Paste a generation link or ID.");
  if (value.length > MAX_LENGTH) throw new ReferenceError("That's too long to be an AI Studio link.");
  if (JOB_ID.test(value)) return { kind: "job", id: value };
  if (OBJECT_ID.test(value)) return { kind: "inference", id: value.toLowerCase() };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ReferenceError("Only https links from AI Studio are accepted.");
  }
  if (url.protocol !== "https:") throw new ReferenceError("Only https links from AI Studio are accepted.");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || (url.port && url.port !== "443")) {
    throw new ReferenceError("This doesn't look like an AI Studio generation link.");
  }

  const q = url.searchParams;
  const first = (...names: string[]) => names.map((n) => q.get(n)?.trim()).find((v) => v) ?? null;

  const inference = first("inference-id", "inference_id");
  if (inference) return checked("inference", inference);
  const path = url.pathname.match(GENERATION_PATH);
  if (path) return checked("inference", decodeURIComponent(path[1]));
  const session = first("unit-session-id", "unit_session_id");
  if (session) return checked("session", session);

  throw new ReferenceError("We couldn't find a generation or session ID in this link.");
}
