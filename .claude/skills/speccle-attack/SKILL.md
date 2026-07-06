---
name: speccle-attack
description: Attack the current PR's claims with real tests. Infers what the PR claims to do, writes attack tests per claim until convergence, and commits them so CI can re-execute and report. Use when the user says "attack this PR", "run speccle", "speccle this branch", or wants survived-attack evidence before review.
---

You are the local half of Speccle: you infer the PR's claims and attack them with real
tests. CI re-executes whatever you commit and owns the sticky comment — your only
deliverables are **committed files**: `.speccle/claims.json` and colocated
`*.attack.test.ts` files. Vocabulary and invariants live in `CONTEXT.md` and
`DESIGN.md`; the file contract lives in `src/contract/` (this repo is the reference
implementation — match it exactly).

## Hard rules

- **Verdicts come from execution, never your opinion.** You propose attacks; vitest
  decides landed/held.
- **Never touch host source code.** You write only the manifest and attack test files.
  If an attack lands, that's the report — do not fix the bug, and NEVER weaken an
  attack to make it pass. (Do fix your own broken test if the failure is the test's
  fault, e.g. a typo or wrong import — a landed attack must demonstrate a genuine
  claim violation.)
- **Never force conventions on the host repo.** Infer from what's there.

## Steps

### 1. Establish PR context

```bash
gh pr view --json number,title,body,baseRefName 2>/dev/null
```

If a PR exists, use its title/body; otherwise use the branch's commits and diff against
the default branch. Diff: `git diff <base>...HEAD` (exclude `.speccle/` and
`*.attack.test.*`).

### 2. Read prior state

- Existing manifest `.speccle/claims.json`, if any — **reuse claim ids** for claims
  that are substantially the same, so curation survives re-runs.
- Curation, if a PR and sticky comment exist: fetch the comment whose body contains
  `speccle:sticky`; a line `- [ ] \`<id>\`` means the author curated that claim out —
  do not attack it, but keep it in the manifest.

```bash
gh api "repos/{owner}/{repo}/issues/<pr>/comments" --paginate \
  --jq '.[] | select(.body | contains("speccle:sticky")) | .body'
```

### 3. Infer claims

From the diff, PR title/description, linked issues, and existing tests, extract what
the change **claims to do** — behavioral, attackable statements ("rejects negative
amounts", "retries idempotently on timeout"), not implementation notes. Typically 2–6
claims; every claim must name behavior a test could contradict.

Claim ids: kebab-case slug of the first ≤4 meaningful words (drop stop-words and
punctuation), deduplicated with a `-2` suffix — the same rule as `slugForClaim` in
`src/contract/manifest.ts`.

### 4. Write the manifest

`.speccle/claims.json`:

```json
{
  "version": 1,
  "headSha": "<effective code head>",
  "claims": [
    { "id": "<slug>", "text": "<claim>", "source": "diff|title|description|issue", "attacks": [] }
  ]
}
```

`headSha` is the **effective code head** — the newest commit touching anything outside
`.speccle/` and attack files:

```bash
git rev-list -1 HEAD -- . ':(exclude).speccle' ':(exclude)*.attack.test.*'
```

### 5. Attack loop — per curated-in claim

Repeat until the claim has **held 3 consecutive attacks** or **6 attacks total**:

1. Design a *distinct* attack: a different angle each time — boundary values, empty and
   malformed inputs, unexpected state or ordering, unicode, concurrency, resource
   exhaustion. Let the previous outcome inform the next attack.
2. Add a test to the colocated attack file (`<module>.attack.test.ts`, next to the code
   under attack). Every test title MUST start with the claim token:
   `[speccle:<claim-id>] <what this attack probes>`.
3. Run it: `pnpm vitest run <file>` (or the host's equivalent). Test passed → the claim
   **held**; test failed → the attack **landed**. If it landed, verify the test itself
   is correct before recording — then leave the failing test in place.
4. Append the attack to the claim's `attacks` array: `{ "title", "file", "outcome": "held" | "landed" }`.

Attack tests are real tests: they merge as regression tests by default and must read
like tests the host repo would keep. Import the code under attack the way neighboring
tests do.

### 6. Commit — attacks and manifest only

One commit containing **only** `.speccle/claims.json` and `*.attack.test.ts` files —
never mix in code changes, or the staleness check breaks. Short single-line message,
e.g. `Speccle: attack 3 claims (1 landed)`. Push if the branch has a remote.

### 7. Report to the user

Summarize per claim: attempted / held / landed, with file paths for landed attacks.
Remind them: CI posts the sticky comment; curation is the checkboxes on it.
