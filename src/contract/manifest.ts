/**
 * The claims manifest: `.speccle/claims.json` on the PR branch.
 *
 * This file is the contract between any local agent (which writes it) and the
 * zero-LLM CI job (which reads it). Machine-written, machine-read — humans
 * curate via sticky-comment checkboxes, never by editing this file.
 */

export const MANIFEST_PATH = ".speccle/claims.json";
export const MANIFEST_VERSION = 1;

/** What happened when an attack test ran, per execution — never LLM opinion. */
export type AttackOutcome = "landed" | "held";

export interface AttackRecord {
  /** Full test title, which must carry the claim's `[speccle:<id>]` token. */
  title: string;
  /** Repo-relative path of the colocated `*.attack.test.ts` file. */
  file: string;
  /** Outcome recorded by the local agent's run; CI recomputes its own. */
  outcome: AttackOutcome;
}

export interface Claim {
  /** Short stable slug, reused across re-inference so curation survives pushes. */
  id: string;
  /** The claim itself: what the PR is supposed to do. */
  text: string;
  /** Where the claim was inferred from, e.g. "diff", "description", "title". */
  source: string;
  attacks: AttackRecord[];
}

export interface Manifest {
  version: typeof MANIFEST_VERSION;
  /**
   * The code head the attacks were generated against: the newest commit
   * touching files outside `.speccle/` and `*.attack.test.*`. Compared against
   * the same computation on the PR branch to detect staleness — the speccle
   * commit itself (attacks + manifest only) never makes a report stale.
   */
  headSha: string;
  claims: Claim[];
}

export class ManifestError extends Error {}

function fail(path: string, expected: string): never {
  throw new ManifestError(`Invalid manifest: ${path} — expected ${expected}`);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(path, "a non-empty string");
  return value;
}

/** Parse and validate manifest JSON. Throws ManifestError with a precise path on any defect. */
export function parseManifest(json: string): Manifest {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (cause) {
    throw new ManifestError(`Invalid manifest: not valid JSON (${(cause as Error).message})`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("$", "an object");
  const obj = raw as Record<string, unknown>;

  if (obj.version !== MANIFEST_VERSION) fail("version", `${MANIFEST_VERSION}`);
  const headSha = requireString(obj.headSha, "headSha");
  if (!Array.isArray(obj.claims)) fail("claims", "an array");

  const seenIds = new Set<string>();
  const claims = obj.claims.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) fail(`claims[${i}]`, "an object");
    const c = entry as Record<string, unknown>;
    const id = requireString(c.id, `claims[${i}].id`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`claims[${i}].id`, "a lowercase kebab-case slug");
    if (seenIds.has(id)) fail(`claims[${i}].id`, `a unique id ("${id}" is duplicated)`);
    seenIds.add(id);
    const text = requireString(c.text, `claims[${i}].text`);
    const source = requireString(c.source, `claims[${i}].source`);
    if (!Array.isArray(c.attacks)) fail(`claims[${i}].attacks`, "an array");
    const attacks = c.attacks.map((a, j) => {
      if (typeof a !== "object" || a === null) fail(`claims[${i}].attacks[${j}]`, "an object");
      const att = a as Record<string, unknown>;
      const outcome = att.outcome;
      if (outcome !== "landed" && outcome !== "held")
        fail(`claims[${i}].attacks[${j}].outcome`, '"landed" or "held"');
      return {
        title: requireString(att.title, `claims[${i}].attacks[${j}].title`),
        file: requireString(att.file, `claims[${i}].attacks[${j}].file`),
        outcome: outcome as AttackOutcome,
      };
    });
    return { id, text, source, attacks };
  });

  return { version: MANIFEST_VERSION, headSha, claims };
}

/**
 * Derive a stable claim id from claim text: the first few meaningful words,
 * kebab-cased, deduplicated against ids already in use.
 */
export function slugForClaim(text: string, existingIds: ReadonlySet<string>): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
  const base = words.slice(0, 4).join("-") || "claim";
  if (!existingIds.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

const STOP_WORDS = new Set(["the", "a", "an", "is", "are", "to", "of", "and", "that", "it", "when"]);
