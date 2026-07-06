# Speccle — design record

Ratified in a grill-me session on 2026-07-06 (mission and core decisions) and a
grill-with-docs session the same day (contract specifics, naming, stack). Speccle is the
restart of the mission behind the original spec-tool of the same name, now archived as
[`matthewalton/speccle-old`](https://github.com/matthewalton/speccle-old) and kept as an
idea mine.

## Mission

Relieve the **team PR-review bottleneck**. Root cause chosen: signals don't buy trust —
CI green and bot comments still make reviewers read every line. Speccle turns signals
into trust with **survived-attack evidence**: "attacked and held", not "checks were
green".

Every design step is re-checked against one sentence: *does this get an agent attacking
PRs sooner?*

## How it works

The author's **local agent** (their own harness and subscription — Claude Code skill
first, but the contract is files, so any agent can comply) infers the PR's claims,
writes real attack tests against them, and commits both to the branch. A **zero-LLM**
GitHub Action re-executes the attacks mechanically and owns one sticky comment holding
the claims checklist and the attack report. No company LLM billing anywhere in CI.

## Decisions

Each was an explicit choice among alternatives.

- **Attack primitive (v1):** agent-authored attack tests — real runnable tests probing
  edge inputs/state against the PR's claims. The verdict is execution, never LLM
  opinion; the LLM only proposes attacks.
- **Loop endpoint (v1):** report only. No autofix, no proposed patches.
- **Intent source:** structured PR claims, bot-proposed, author-curated via checkboxes
  (opt in/out per claim). The curated claim list is the visible contract of what gets
  attacked. Zero conventions required of the host repo.
- **Claims home:** one sticky bot comment holding claims + latest attack report.
- **Timing:** attacks start immediately on inferred claims (all checked by default);
  curation and new pushes trigger re-runs.
- **Architecture (key constraint):** local agent generates, CI verifies. The company
  won't pay LLM billing in CI, so all LLM work runs on each dev's local agent; CI is
  deterministic re-execution only.
- **Claims manifest:** `.speccle/claims.json` — JSON, machine-written by the local
  agent, machine-read by CI. Humans curate via checkboxes, not by editing the file.
- **Attack test placement:** colocated `*.attack.test.ts` next to the code under
  attack. Matches the near-universal `**/*.test.ts` glob, so merged attacks run in the
  host's own CI as regression tests with zero config, and are prunable per-file by the
  author before merge.
- **Title-token join:** attack test titles carry `[speccle:<claimId>]`; CI joins test
  results to claims by token. Claim IDs are short stable slugs assigned at inference and
  reused across re-inference so curation state survives pushes.
- **Curation source of truth:** the sticky comment's checkbox state. The manifest holds
  the full inferred claim list; CI re-renders the report on comment edit, excluding
  unticked claims; the local agent reads checkbox state via `gh` before generating
  attacks. Curation never costs a push.
- **Adjudication:** the author resolves landed attacks — bug (stays red until fixed) or
  expected behavior (moves to a dismissed-with-reason section the reviewer can still
  see). Invariant: the agent is never wrong silently.
- **Loop termination:** convergence with caps — per claim, attack until the claim holds
  K (~3) consecutive attacks, hard cap ~6–8 attacks/claim. The report always states
  attempted counts so holding is never mistaken for exhaustiveness.
- **Check verdict (v1):** always neutral. Red only for mechanical failures (attack
  files don't run, stale or invalid manifest). Gate mode is opt-in later, once
  dismiss-rates earn it.
- **Merge policy:** attack tests merge by default as regression tests, prunable by the
  author.
- **Context:** personal OSS first, dogfooded on Speccle's own PRs (honest this time —
  the tool consumes PRs, not conventions), then a pilot on one work repo (GitHub +
  TypeScript).
- **Stack:** TypeScript, pnpm, vitest. Public repo from day one.

## Vocabulary

An attack **lands** when its test demonstrates behavior contradicting the claim; the
claim **holds** the attack when the test passes. See CONTEXT.md for the full glossary.

## Working agreements

From the diagnosis of the original Speccle's drift (premature architecture, convention
churn, mission drift by locally-plausible steps):

- Single package until pain.
- No ADR before a contested decision.
- Never force conventions on the host repo.
- Test every step against the mission sentence: does this get an agent attacking PRs
  sooner?

## Borrowed from speccle-old (ideas, not code)

Typed report model · test-title token join · deterministic-tools/LLM-at-the-edges
discipline · CONTEXT.md glossary habit · possibly the mutation engine later as a second
attack type.
