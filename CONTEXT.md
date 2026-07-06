# Glossary

- **Claim** — a statement of what the PR is supposed to do, inferred by the local agent
  from the diff, PR title/description, linked issues, and existing tests. Bot-proposed,
  author-curated.
- **Attack** — a real, runnable test written by the local agent to probe a claim with
  edge inputs or state. Committed to the branch as a colocated `*.attack.test.ts` file.
- **Lands** — an attack lands when its test demonstrates behavior contradicting the
  claim (the test fails against the claim's promise).
- **Holds** — a claim holds an attack when the test passes; "attacked and held" is the
  trust evidence Speccle exists to produce.
- **Curation** — the author opting claims in or out via checkboxes on the sticky
  comment. Checkbox state is the source of truth; curated-out claims are not attacked
  and are excluded from the report.
- **Convergence** — the attack loop's stopping rule for a claim: K (~3) consecutive
  attacks held, subject to a hard cap of attacks per claim.
- **Manifest** — `.speccle/claims.json`: the machine-written file on the branch listing
  claims and their attack records; the contract between any local agent and CI.
- **Sticky comment** — the single bot comment on the PR, owned by CI, holding the
  claims checklist and the latest attack report.
- **Stale** — the manifest's recorded head SHA no longer matches the PR's actual head;
  the report can't be trusted until the local agent re-runs.
- **Adjudication** — the author resolving a landed attack as either a bug or expected
  behavior.
- **Dismissed** — a landed attack adjudicated as expected behavior; it moves to a
  dismissed-with-reason section that stays visible to reviewers.
