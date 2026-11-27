import { describe, expect, it } from "vitest";
import type { JoinedReport } from "../contract/join.ts";
import { parseCuratedOut, renderStickyComment, STICKY_MARKER } from "./comment.ts";

const report: JoinedReport = {
  claims: [
    {
      claimId: "rejects-negatives",
      text: "Rejects negative amounts",
      attacks: [
        { title: "[speccle:rejects-negatives] throws on -1", file: "src/pay.attack.test.ts", outcome: "held" },
        { title: "[speccle:rejects-negatives] throws on -0.5", file: "src/pay.attack.test.ts", outcome: "landed" },
      ],
      attempted: 2,
      landed: 1,
      held: 1,
    },
    {
      claimId: "handles-empty",
      text: "Handles empty input",
      attacks: [],
      attempted: 0,
      landed: 0,
      held: 0,
    },
  ],
  orphans: [],
};

function render(overrides: Partial<Parameters<typeof renderStickyComment>[0]> = {}): string {
  return renderStickyComment({
    report,
    manifestSha: "abc1234def",
    headSha: "abc1234def",
    curatedOut: new Set(),
    ...overrides,
  });
}

describe("renderStickyComment", () => {
  it("starts with the sticky marker", () => {
    expect(render().startsWith(STICKY_MARKER)).toBe(true);
  });

  it("renders one checkbox line per claim, ticked by default", () => {
    const body = render();
    expect(body).toContain("- [x] `rejects-negatives` — Rejects negative amounts");
    expect(body).toContain("- [x] `handles-empty` — Handles empty input");
  });

  it("states attempted counts", () => {
    expect(render()).toContain("**2** attacks attempted");
  });

  it("lists landed attacks as unresolved", () => {
    const body = render();
    expect(body).toContain("### Landed attacks — unresolved");
    expect(body).toContain("throws on -0.5");
  });

  it("flags staleness when the manifest SHA is behind head", () => {
    const body = render({ headSha: "fff9999aaa" });
    expect(body).toContain("**Stale.**");
    expect(body).toContain("abc1234");
    expect(body).toContain("fff9999");
  });

  it("is not stale when SHAs match", () => {
    expect(render()).not.toContain("Stale");
  });

  it("excludes curated-out claims from totals and landed list but keeps their checkbox", () => {
    const body = render({ curatedOut: new Set(["rejects-negatives"]) });
    expect(body).toContain("- [ ] `rejects-negatives`");
    expect(body).toContain("_curated out_");
    expect(body).toContain("**0** attacks attempted");
    expect(body).not.toContain("### Landed attacks");
  });

  it("collapses whitespace in claim text so it cannot break the checkbox line", () => {
    const hostile = {
      ...report,
      claims: [{ ...report.claims[0]!, text: "First line\n- [ ] `injected` — fake claim" }],
    };
    const body = renderStickyComment({
      report: hostile,
      manifestSha: "abc",
      headSha: "abc",
      curatedOut: new Set(),
    });
    expect(body).toContain("First line - [ ] `injected` — fake claim");
    expect(parseCuratedOut(body)).toEqual(new Set());
  });

  it("reports orphaned attack tests", () => {
    const body = render({
      report: { ...report, orphans: [{ title: "[speccle:gone] probe", file: "src/x.attack.test.ts", passed: true }] },
    });
    expect(body).toContain("### Orphaned attack tests");
    expect(body).toContain("[speccle:gone] probe");
  });
});

describe("parseCuratedOut", () => {
  it("round-trips curation state through render", () => {
    const body = render({ curatedOut: new Set(["handles-empty"]) });
    expect(parseCuratedOut(body)).toEqual(new Set(["handles-empty"]));
  });

  it("returns empty for a body with all boxes ticked", () => {
    expect(parseCuratedOut(render())).toEqual(new Set());
  });

  it("reads an author's manual untick", () => {
    const body = render().replace("- [x] `handles-empty`", "- [ ] `handles-empty`");
    expect(parseCuratedOut(body)).toEqual(new Set(["handles-empty"]));
  });

  it("ignores checkbox-looking lines without a claim id in backticks", () => {
    expect(parseCuratedOut("- [ ] just a todo item\n- [ ] `Not-A-Slug`")).toEqual(new Set());
  });
});
