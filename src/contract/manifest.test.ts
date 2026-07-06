import { describe, expect, it } from "vitest";
import { ManifestError, parseManifest, slugForClaim } from "./manifest.ts";

const valid = {
  version: 1,
  headSha: "abc123",
  claims: [
    {
      id: "rejects-negative-amounts",
      text: "Rejects negative amounts",
      source: "description",
      attacks: [
        {
          title: "[speccle:rejects-negative-amounts] throws on -1",
          file: "src/pay.attack.test.ts",
          outcome: "held",
        },
      ],
    },
  ],
};

describe("parseManifest", () => {
  it("accepts a valid manifest", () => {
    const manifest = parseManifest(JSON.stringify(valid));
    expect(manifest.claims).toHaveLength(1);
    expect(manifest.claims[0]?.attacks[0]?.outcome).toBe("held");
  });

  it("rejects non-JSON", () => {
    expect(() => parseManifest("{nope")).toThrow(ManifestError);
  });

  it("rejects a wrong version", () => {
    expect(() => parseManifest(JSON.stringify({ ...valid, version: 2 }))).toThrow(/version/);
  });

  it("rejects a missing headSha", () => {
    const { headSha: _headSha, ...rest } = valid;
    expect(() => parseManifest(JSON.stringify(rest))).toThrow(/headSha/);
  });

  it("rejects duplicate claim ids with the offending id in the message", () => {
    const doubled = { ...valid, claims: [valid.claims[0], valid.claims[0]] };
    expect(() => parseManifest(JSON.stringify(doubled))).toThrow(/duplicated/);
  });

  it("rejects an id that is not a kebab-case slug", () => {
    const bad = { ...valid, claims: [{ ...valid.claims[0], id: "Not A Slug" }] };
    expect(() => parseManifest(JSON.stringify(bad))).toThrow(/kebab-case/);
  });

  it("rejects an unknown attack outcome with a precise path", () => {
    const bad = {
      ...valid,
      claims: [
        {
          ...valid.claims[0],
          attacks: [{ title: "t", file: "f", outcome: "survived" }],
        },
      ],
    };
    expect(() => parseManifest(JSON.stringify(bad))).toThrow(/claims\[0\]\.attacks\[0\]\.outcome/);
  });
});

describe("slugForClaim", () => {
  it("kebab-cases the first meaningful words", () => {
    expect(slugForClaim("The parser rejects negative amounts", new Set())).toBe(
      "parser-rejects-negative-amounts",
    );
  });

  it("drops punctuation", () => {
    expect(slugForClaim("Doesn't crash on empty input!", new Set())).toBe(
      "doesnt-crash-on-empty",
    );
  });

  it("dedupes against existing ids with a numeric suffix", () => {
    const existing = new Set(["parser-rejects-negative-amounts"]);
    expect(slugForClaim("Parser rejects negative amounts", existing)).toBe(
      "parser-rejects-negative-amounts-2",
    );
  });

  it("falls back to 'claim' when no meaningful words remain", () => {
    expect(slugForClaim("!!!", new Set())).toBe("claim");
  });
});
