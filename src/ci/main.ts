/**
 * CI entrypoint — zero LLM. Reads the manifest, re-executes the branch's
 * attack tests mechanically, joins results to claims, and emits the sticky
 * comment body for the workflow to post.
 *
 * Env in:
 *   HEAD_SHA               the PR's actual head SHA (required)
 *   EXISTING_COMMENT_FILE  path to the current sticky comment body, if any
 *   COMMENT_OUT            where to write the rendered comment (required)
 *   GITHUB_OUTPUT          standard Actions output file, receives should_post
 *
 * Exit codes: 0 = report posted (or nothing to do); 1 = mechanical failure
 * (invalid manifest, attack files that don't run, stale report). The check
 * never goes red for a landed attack — report-only in v1.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { joinResults } from "../contract/join.ts";
import { MANIFEST_PATH, parseManifest } from "../contract/manifest.ts";
import { parseCuratedOut, renderStickyComment } from "../comment/comment.ts";
import { parseVitestJson } from "./vitestJson.ts";

function output(key: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${key}=${value}\n`);
}

function main(): number {
  const headSha = process.env.HEAD_SHA;
  const commentOut = process.env.COMMENT_OUT;
  if (!headSha || !commentOut) {
    console.error("HEAD_SHA and COMMENT_OUT are required");
    return 1;
  }

  if (!existsSync(MANIFEST_PATH)) {
    console.log(`No ${MANIFEST_PATH} on this branch — nothing to do.`);
    output("should_post", "false");
    return 0;
  }
  const manifest = parseManifest(readFileSync(MANIFEST_PATH, "utf8"));

  const attackFiles = spawnSync("git", ["ls-files", "*.attack.test.*"], { encoding: "utf8" })
    .stdout.split("\n")
    .filter((f) => f.length > 0);

  let results: ReturnType<typeof parseVitestJson> = [];
  if (attackFiles.length > 0) {
    const resultsPath = ".speccle/vitest-results.json";
    const run = spawnSync(
      "pnpm",
      ["vitest", "run", "--reporter=json", `--outputFile=${resultsPath}`, ...attackFiles],
      { encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] },
    );
    if (run.error || !existsSync(resultsPath)) {
      console.error("Mechanical failure: attack tests did not produce results", run.error ?? "");
      return 1;
    }
    // Nonzero exit here just means some attacks landed — that's the report, not a failure.
    results = parseVitestJson(readFileSync(resultsPath, "utf8"), process.cwd());
  }

  const existingFile = process.env.EXISTING_COMMENT_FILE;
  const existingBody = existingFile && existsSync(existingFile) ? readFileSync(existingFile, "utf8") : "";
  const curatedOut = parseCuratedOut(existingBody);

  const report = joinResults(manifest, results);
  const body = renderStickyComment({ report, manifestSha: manifest.headSha, headSha, curatedOut });
  writeFileSync(commentOut, body);
  output("should_post", "true");

  if (manifest.headSha !== headSha) {
    console.error(`Stale: manifest is for ${manifest.headSha}, head is ${headSha}. Comment posted with warning.`);
    return 1;
  }
  console.log(`Report rendered: ${report.claims.length} claims, ${results.length} executed attack tests.`);
  return 0;
}

process.exitCode = main();
