/**
 * Adapter from vitest's JSON reporter output (jest-compatible shape) to the
 * contract's TestResult. CI trusts only this — execution is the verdict.
 */

import { relative } from "node:path";
import type { TestResult } from "../contract/join.ts";

export class VitestOutputError extends Error {}

interface AssertionResult {
  fullName?: unknown;
  title?: unknown;
  status?: unknown;
}

/**
 * Parse `vitest run --reporter=json` output. `repoRoot` makes file paths
 * repo-relative. Skipped/todo tests are ignored — only executed tests count.
 */
export function parseVitestJson(json: string, repoRoot: string): TestResult[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (cause) {
    throw new VitestOutputError(`vitest JSON output is not valid JSON (${(cause as Error).message})`);
  }
  const files = (raw as { testResults?: unknown }).testResults;
  if (!Array.isArray(files)) throw new VitestOutputError("vitest JSON output has no testResults array");

  const results: TestResult[] = [];
  for (const file of files) {
    const name = (file as { name?: unknown }).name;
    const assertions = (file as { assertionResults?: unknown }).assertionResults;
    if (typeof name !== "string" || !Array.isArray(assertions))
      throw new VitestOutputError("vitest JSON output has a malformed testResults entry");
    for (const assertion of assertions as AssertionResult[]) {
      const title = typeof assertion.fullName === "string" ? assertion.fullName : assertion.title;
      if (typeof title !== "string") throw new VitestOutputError("vitest JSON output has a test without a title");
      if (assertion.status !== "passed" && assertion.status !== "failed") continue;
      results.push({
        title,
        file: relative(repoRoot, name),
        passed: assertion.status === "passed",
      });
    }
  }
  return results;
}
