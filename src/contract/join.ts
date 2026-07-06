/**
 * The title-token join: attack test titles carry `[speccle:<claimId>]`, letting
 * CI join mechanical test results back to claims with zero knowledge of how the
 * tests were produced.
 */

import type { AttackOutcome, AttackRecord, Manifest } from "./manifest.ts";

const TOKEN_RE = /\[speccle:([a-z0-9][a-z0-9-]*)\]/;

export function claimToken(claimId: string): string {
  return `[speccle:${claimId}]`;
}

/** Extract the claim id from a test title, or null if it carries no token. */
export function extractClaimId(title: string): string | null {
  return TOKEN_RE.exec(title)?.[1] ?? null;
}

/** One executed test, as reported by the runner. Pass/fail is ground truth. */
export interface TestResult {
  title: string;
  file: string;
  passed: boolean;
}

export interface ClaimReport {
  claimId: string;
  text: string;
  attacks: AttackRecord[];
  /** Attempted counts keep holding from being mistaken for exhaustiveness. */
  attempted: number;
  landed: number;
  held: number;
}

export interface JoinedReport {
  claims: ClaimReport[];
  /** Results carrying a token that matches no claim in the manifest. */
  orphans: TestResult[];
}

/**
 * Join executed test results to the manifest's claims by title token.
 * A passing attack test means the claim held; a failing one means the attack landed.
 * Results without a speccle token are ignored — they're the host repo's own tests.
 */
export function joinResults(manifest: Manifest, results: readonly TestResult[]): JoinedReport {
  const byClaim = new Map<string, AttackRecord[]>(manifest.claims.map((c) => [c.id, []]));
  const orphans: TestResult[] = [];

  for (const result of results) {
    const claimId = extractClaimId(result.title);
    if (claimId === null) continue;
    const attacks = byClaim.get(claimId);
    if (attacks === undefined) {
      orphans.push(result);
      continue;
    }
    const outcome: AttackOutcome = result.passed ? "held" : "landed";
    attacks.push({ title: result.title, file: result.file, outcome });
  }

  const claims = manifest.claims.map((claim) => {
    const attacks = byClaim.get(claim.id) ?? [];
    const landed = attacks.filter((a) => a.outcome === "landed").length;
    return {
      claimId: claim.id,
      text: claim.text,
      attacks,
      attempted: attacks.length,
      landed,
      held: attacks.length - landed,
    };
  });

  return { claims, orphans };
}
