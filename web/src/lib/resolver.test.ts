import { describe, expect, it } from "vitest";
import { redact } from "./redact";
import { parseReference } from "./resolver";

const ID = "665f1e2a9b3c4d5e6f708192";
const SESSION = "665f1e1f9b3c4d5e6f708100";

describe("parseReference", () => {
  it.each([
    [`https://aistudio.galleri5.com/model-garden?inference-id=${ID}&unit-session-id=${SESSION}`, { kind: "inference", id: ID }],
    [`https://aistudio.galleri5.com/generations/${ID.toUpperCase()}/`, { kind: "inference", id: ID }],
    [`https://aistudio.galleri5.com/model-garden/x?unit-session-id=${SESSION}`, { kind: "session", id: SESSION }],
    [`  ${ID} `, { kind: "inference", id: ID }],
    ["jr-7c41a9e2", { kind: "job", id: "jr-7c41a9e2" }],
  ])("accepts %s", (raw, want) => expect(parseReference(raw)).toEqual(want));

  it.each([
    ["", /Paste a generation link/],
    [`http://aistudio.galleri5.com/generations/${ID}`, /Only https/],
    [`https://aistudio.galleri5.com.evil.com/generations/${ID}`, /AI Studio generation link/],
    [`https://user:pw@aistudio.galleri5.com/generations/${ID}`, /AI Studio generation link/],
    [`https://aistudio.galleri5.com:8443/generations/${ID}`, /AI Studio generation link/],
    ["javascript:alert(1)", /Only https/],
    ["https://aistudio.galleri5.com/generations/not-an-id", /doesn't look valid/],
    ["https://aistudio.galleri5.com/model-garden?tab=templates", /couldn't find a generation/],
  ])("rejects %s", (raw, message) => expect(() => parseReference(raw)).toThrow(message));
});

describe("redact", () => {
  it("keeps only the host of links", () => {
    const out = redact("callback https://jobs.example.internal/webhook?token=abc123SECRET failed");
    expect(out).toContain("https://jobs.example.internal/…");
    expect(out).not.toContain("SECRET");
  });
  it("hides keys, tokens and emails", () => {
    const out = redact("Bearer abcdefghijklmnop12345 sk-live_ABCDEFGHIJKLMNOPQRST artist@galleri5.com");
    for (const s of ["abcdefghijklmnop12345", "sk-live_", "artist@galleri5.com"]) expect(out).not.toContain(s);
  });
});
