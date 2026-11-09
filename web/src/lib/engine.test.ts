import { describe, expect, it } from "vitest";
import expectedJson from "../../../shared/expected-diagnoses.json";
import rulesJson from "../../../shared/diagnostic-rules.json";
import samplesJson from "../../../shared/sample-generations.json";
import { diagnoseGeneration, fmtDuration, fmtNumber } from "./engine";
import type { Generation, PlatformCounts, RulesDoc } from "./types";

const RULES = rulesJson as unknown as RulesDoc;
const SAMPLES = samplesJson as unknown as { generations: Generation[]; platform_counts_last_60m: PlatformCounts };
const EXPECTED = (expectedJson as { expected: Record<string, { code: string; confidence: string }> }).expected;
const diagnose = (id: string) =>
  diagnoseGeneration(SAMPLES.generations.find((g) => g.inference_id === id)!, RULES, SAMPLES.platform_counts_last_60m);

describe("parity with shared/expected-diagnoses.json", () => {
  for (const [id, want] of Object.entries(EXPECTED)) {
    it(`${id} → ${want.code}`, () => {
      const report = diagnose(id);
      expect(report.diagnostic_code).toBe(want.code);
      expect(report.confidence).toBe(want.confidence);
    });
  }
});

describe("report content", () => {
  it("quotes the real credit numbers", () => {
    const r = diagnose("665f1e2a9b3c4d5e6f708192");
    expect(r.status_label).toBe("Failed: Not enough workspace credits");
    expect(r.cause).toBe("This run needed 1,200 credits. The workspace credit pool had 9.");
    expect(r.stages.map((s) => s.state)).toEqual(["ok", "fail", "skip", "skip", "skip"]);
  });

  it("flags a platform-wide provider problem", () => {
    const r = diagnose("665f22b09b3c4d5e6f7081a4");
    expect(r.platform_notice).toContain("14 similar failures");
    expect(r.cause).toContain("FAL");
  });

  it("never leaks the callback token", () => {
    const blob = JSON.stringify(diagnose("665f41de9b3c4d5e6f708233"));
    expect(blob).not.toContain("SECRET");
    expect(blob).not.toContain("token=");
  });

  it("treats a finished job as not a failure", () => {
    const r = diagnose("665f30c49b3c4d5e6f7081f0");
    expect(r.status_label).toBe("Completed");
    expect(r.summary).toContain("5 min 10 s");
  });

  it("is honest when evidence is missing", () => {
    const r = diagnose("665f52aa9b3c4d5e6f708301");
    expect(r.confidence).toBe("insufficient");
    expect(r.missing_information).toContain("A recorded error message");
  });
});

describe("formatting matches the Python service", () => {
  it.each([
    [null, "an unknown time"],
    [9, "9 s"],
    [60, "1 min"],
    [310, "5 min 10 s"],
  ])("fmtDuration(%s)", (s, text) => expect(fmtDuration(s)).toBe(text));
  it.each([
    ["1200.0", "1,200"],
    ["9.0", "9"],
    ["1200.5", "1,200.5"],
    ["abc", "abc"],
  ])("fmtNumber(%s)", (raw, text) => expect(fmtNumber(raw)).toBe(text));
});
