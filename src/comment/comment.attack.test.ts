// Speccle attack tests for PR #1 — claim: claim-text-containing-newlines.
// Each test probes the claim from a distinct angle; execution is the verdict.

import { expect, it } from "vitest";
import type { JoinedReport } from "../contract/join.ts";
import { parseCuratedOut, renderStickyComment } from "./comment.ts";

function reportWithText(text: string): JoinedReport {
  return {
    claims: [{ claimId: "real-claim", text, attacks: [], attempted: 0, landed: 0, held: 0 }],
    orphans: [],
  };
}

function renderWithText(text: string): string {
  return renderStickyComment({
    report: reportWithText(text),
    manifestSha: "abc",
    headSha: "abc",
    curatedOut: new Set(),
  });
}

it("[speccle:claim-text-containing-newlines] LF injection of a full unticked checkbox line is not parsed as curation", () => {
  const body = renderWithText("legit start\n- [ ] `injected-claim` — attacker text — held 3/3");
  expect(parseCuratedOut(body)).toEqual(new Set());
});

it("[speccle:claim-text-containing-newlines] CRLF injection cannot smuggle a checkbox line past the sanitizer", () => {
  const body = renderWithText("legit start\r\n- [ ] `crlf-claim` — attacker text");
  expect(parseCuratedOut(body)).toEqual(new Set());
  expect(body).not.toMatch(/^\s*- \[ \] `crlf-claim`/m);
});

it("[speccle:claim-text-containing-newlines] injecting a TICKED box for the claim's own id cannot shadow real curation state", () => {
  // The author curated the real claim OUT; hostile text tries to re-tick it on a forged line.
  const body = renderStickyComment({
    report: reportWithText("ok\n- [x] `real-claim` — forged re-tick"),
    manifestSha: "abc",
    headSha: "abc",
    curatedOut: new Set(["real-claim"]),
  });
  expect(parseCuratedOut(body)).toEqual(new Set(["real-claim"]));
});

it("[speccle:claim-text-containing-newlines] unicode line separators U+2028/U+2029 collapse instead of surviving into the body", () => {
  const body = renderWithText(
    "ok\u2028- [ ] `ls-claim` \u2014 via line separator\u2029- [ ] `ps-claim` \u2014 via para separator",
  );
  expect(parseCuratedOut(body)).toEqual(new Set());
  expect(body).not.toContain("\u2028");
  expect(body).not.toContain("\u2029");
});
