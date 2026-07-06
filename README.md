# Speccle

**Attacked and held.** Speccle turns PR signals into trust: the author's local agent
infers what a PR claims to do, writes real attack tests against those claims, and
commits them; a zero-LLM GitHub Action re-executes the attacks and posts one sticky
comment reporting which claims held.

Reviewers stop re-reading every line because "checks were green" becomes "this claim
held 3 consecutive adversarial attacks — here they are, runnable".

## How it fits together

1. **Local agent** (Claude Code skill first; the contract is files, any harness can
   comply) infers claims from the diff and PR description, writes them to
   `.speccle/claims.json`, and generates colocated `*.attack.test.ts` files per claim
   until convergence.
2. **You curate** via checkboxes on the sticky comment — opt claims in or out, no push
   needed.
3. **CI** (zero LLM) re-executes the attack tests mechanically, joins results to claims
   via `[speccle:<claimId>]` title tokens, and updates the sticky comment. The check is
   neutral in v1; report only.
4. **Attacks merge as regression tests** by default — prune any you don't want before
   merging.

See [DESIGN.md](./DESIGN.md) for the decision record and [CONTEXT.md](./CONTEXT.md) for
the glossary.

## Status

Early. Currently dogfooding on this repo's own PRs.
