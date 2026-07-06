import { describe, expect, it } from "vitest";
import { claimToken, extractClaimId, joinResults, type TestResult } from "./join.ts";
import type { Manifest } from "./manifest.ts";

const manifest: Manifest = {
  version: 1,
  headSha: "abc123",
  claims: [
    { id: "rejects-negatives", text: "Rejects negative amounts", source: "diff", attacks: [] },
    { id: "handles-empty", text: "Handles empty input", source: "description", attacks: [] },
  ],
};

function result(title: string, passed: boolean): TestResult {
  return { title, file: "src/x.attack.test.ts", passed };
}

describe("claimToken / extractClaimId", () => {
  it("round-trips a claim id through a test title", () => {
    const title = `${claimToken("rejects-negatives")} throws on -1`;
    expect(extractClaimId(title)).toBe("rejects-negatives");
  });

  it("returns null for a title without a token", () => {
    expect(extractClaimId("plain host-repo test")).toBeNull();
  });

  it("finds the token anywhere in the title", () => {
    expect(extractClaimId("throws on -1 [speccle:rejects-negatives]")).toBe("rejects-negatives");
  });
});

describe("joinResults", () => {
  it("maps pass to held and fail to landed", () => {
    const report = joinResults(manifest, [
      result("[speccle:rejects-negatives] throws on -1", true),
      result("[speccle:rejects-negatives] throws on -0.5", false),
    ]);
    const claim = report.claims.find((c) => c.claimId === "rejects-negatives");
    expect(claim).toMatchObject({ attempted: 2, held: 1, landed: 1 });
    expect(claim?.attacks.map((a) => a.outcome)).toEqual(["held", "landed"]);
  });

  it("ignores host-repo tests without a token", () => {
    const report = joinResults(manifest, [result("ordinary unit test", false)]);
    expect(report.orphans).toHaveLength(0);
    expect(report.claims.every((c) => c.attempted === 0)).toBe(true);
  });

  it("reports tokens that match no claim as orphans", () => {
    const report = joinResults(manifest, [result("[speccle:no-such-claim] probe", true)]);
    expect(report.orphans).toHaveLength(1);
  });

  it("keeps claims with no executed attacks at zero attempted", () => {
    const report = joinResults(manifest, []);
    expect(report.claims).toHaveLength(2);
    expect(report.claims.map((c) => c.attempted)).toEqual([0, 0]);
  });
});
