/**
 * The sticky comment: the single bot comment CI owns on each PR, holding the
 * claims checklist and the latest attack report.
 *
 * Render and parse are two halves of one format. The checkbox lines are the
 * curation source of truth: the author ticks/unticks them, CI re-renders on
 * edit, and the local agent reads them before generating attacks — so the
 * line shape (`- [x] \`claim-id\` — …`) is contract surface, not styling.
 */

import type { JoinedReport } from "../contract/join.ts";

/** Invisible marker identifying the sticky comment among a PR's comments. */
export const STICKY_MARKER = "<!-- speccle:sticky -->";

const CHECKBOX_LINE = /^- \[( |x)\] `([a-z0-9][a-z0-9-]*)`/;

/** Claim ids whose checkbox is unticked in the given comment body. */
export function parseCuratedOut(body: string): Set<string> {
  const out = new Set<string>();
  for (const line of body.split("\n")) {
    const match = CHECKBOX_LINE.exec(line.trim());
    if (match && match[1] === " ") out.add(match[2] as string);
  }
  return out;
}

export interface RenderInput {
  report: JoinedReport;
  /** SHA the manifest was generated against. */
  manifestSha: string;
  /** The branch's effective code head (newest commit outside .speccle/ and attack files). */
  headSha: string;
  /** Claims the author has opted out via checkboxes. */
  curatedOut: ReadonlySet<string>;
}

export function renderStickyComment({ report, manifestSha, headSha, curatedOut }: RenderInput): string {
  const stale = manifestSha !== headSha;
  const active = report.claims.filter((c) => !curatedOut.has(c.claimId));
  const attempted = active.reduce((n, c) => n + c.attempted, 0);
  const held = active.reduce((n, c) => n + c.held, 0);
  const landed = active.reduce((n, c) => n + c.landed, 0);

  const lines: string[] = [STICKY_MARKER, "## Speccle — attacked and held", ""];

  if (stale) {
    lines.push(
      `> [!WARNING]`,
      `> **Stale.** This report was generated against \`${short(manifestSha)}\` but the code head is \`${short(headSha)}\`. Re-run your local agent to refresh it.`,
      "",
    );
  }

  lines.push(
    `**${active.length}** claim${plural(active.length)} under attack · **${attempted}** attack${plural(attempted)} attempted · **${held}** held · **${landed}** landed`,
    "",
    "### Claims",
    "",
    "_Tick or untick to curate — unticked claims are not attacked and drop out of the report._",
    "",
  );

  for (const claim of report.claims) {
    const isOut = curatedOut.has(claim.claimId);
    const box = isOut ? "[ ]" : "[x]";
    const verdict = isOut
      ? "_curated out_"
      : claim.attempted === 0
        ? "no attacks yet"
        : claim.landed > 0
          ? `🔴 **${claim.landed} landed** of ${claim.attempted} attempted`
          : `🛡️ held ${claim.held}/${claim.attempted} attempted`;
    lines.push(`- ${box} \`${claim.claimId}\` — ${claim.text} — ${verdict}`);
  }

  const landedAttacks = active.flatMap((claim) =>
    claim.attacks
      .filter((a) => a.outcome === "landed")
      .map((a) => ({ claimId: claim.claimId, attack: a })),
  );
  if (landedAttacks.length > 0) {
    lines.push("", "### Landed attacks — unresolved", "");
    for (const { claimId, attack } of landedAttacks) {
      lines.push(`- \`${claimId}\`: **${attack.title}** (\`${attack.file}\`)`);
    }
    lines.push(
      "",
      "_A landed attack demonstrates behavior contradicting the claim. Author: resolve as bug or expected behavior._",
    );
  }

  if (report.orphans.length > 0) {
    lines.push("", "### Orphaned attack tests", "");
    for (const orphan of report.orphans) {
      lines.push(`- **${orphan.title}** (\`${orphan.file}\`) — token matches no claim in the manifest`);
    }
  }

  lines.push(
    "",
    `<sub>Attempted counts are stated so holding is never mistaken for exhaustiveness. Report-only: this check never blocks merge. Generated against \`${short(manifestSha)}\`.</sub>`,
  );

  return lines.join("\n");
}

function short(sha: string): string {
  return sha.slice(0, 7);
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}
