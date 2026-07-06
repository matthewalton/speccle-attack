import { describe, expect, it } from "vitest";
import { parseVitestJson, VitestOutputError } from "./vitestJson.ts";

const output = JSON.stringify({
  testResults: [
    {
      name: "/repo/src/pay.attack.test.ts",
      assertionResults: [
        { fullName: "[speccle:rejects-negatives] throws on -1", status: "passed" },
        { fullName: "[speccle:rejects-negatives] throws on -0.5", status: "failed" },
        { fullName: "some skipped probe", status: "skipped" },
      ],
    },
  ],
});

describe("parseVitestJson", () => {
  it("maps executed tests to repo-relative TestResults", () => {
    expect(parseVitestJson(output, "/repo")).toEqual([
      { title: "[speccle:rejects-negatives] throws on -1", file: "src/pay.attack.test.ts", passed: true },
      { title: "[speccle:rejects-negatives] throws on -0.5", file: "src/pay.attack.test.ts", passed: false },
    ]);
  });

  it("throws VitestOutputError on non-JSON", () => {
    expect(() => parseVitestJson("boom", "/repo")).toThrow(VitestOutputError);
  });

  it("throws VitestOutputError when testResults is missing", () => {
    expect(() => parseVitestJson("{}", "/repo")).toThrow(/testResults/);
  });
});
