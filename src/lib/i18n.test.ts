import { describe, expect, it } from "vitest";

import { getDictionary, isLocale, marketName, varietyName } from "./i18n";

type Tree = Record<string, unknown>;

/** Walk both dictionaries in parallel and report keys whose presence or kind differs. */
function diff(a: unknown, b: unknown, path = ""): string[] {
  if (typeof a !== typeof b) return [`${path}: ${typeof a} vs ${typeof b}`];
  if (typeof a === "function") {
    const fa = a as (...args: unknown[]) => unknown;
    const fb = b as (...args: unknown[]) => unknown;
    return fa.length === fb.length ? [] : [`${path}: arity ${fa.length} vs ${fb.length}`];
  }
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length ? [] : [`${path}: array length`];
  }
  if (a && typeof a === "object") {
    const keys = new Set([...Object.keys(a as Tree), ...Object.keys(b as Tree)]);
    return [...keys].flatMap((k) => diff((a as Tree)[k], (b as Tree)[k], `${path}.${k}`));
  }
  return [];
}

function strings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node === "function") return [String((node as (...a: string[]) => string)("1", "2", "3", "4"))];
  if (Array.isArray(node)) return node.flatMap(strings);
  if (node && typeof node === "object") return Object.values(node).flatMap(strings);
  return [];
}

describe("dictionaries", () => {
  const en = getDictionary("en");
  const kn = getDictionary("kn");

  it("have identical shape in both languages", () => {
    expect(diff(en, kn)).toEqual([]);
  });

  it("Kannada copy is actually in Kannada script", () => {
    const skip = new Set(["AdikeCast", "English", "JSON API"]);
    const untranslated = strings(kn).filter(
      (s) => !skip.has(s) && /[A-Za-z]{4,}/.test(s) && !/[ಀ-೿]/.test(s),
    );
    expect(untranslated).toEqual([]);
  });

  it("interpolates arguments", () => {
    expect(en.actionLong.HOLD("16 Nov")).toBe("Hold until 16 Nov");
    expect(kn.actionLong.HOLD("16 Nov")).toContain("16 Nov");
  });
});

describe("names", () => {
  it("localises known markets and varieties, falls back to the raw name", () => {
    expect(marketName("Mangalore", "en")).toBe("Mangaluru");
    expect(marketName("Mangalore", "kn")).toBe("ಮಂಗಳೂರು");
    expect(varietyName("New Variety", "kn")).toBe("ಹೊಸ ಚಾಲಿ");
    expect(marketName("Kasaragod", "kn")).toBe("Kasaragod");
  });

  it("validates locales", () => {
    expect(isLocale("kn")).toBe(true);
    expect(isLocale("hi")).toBe(false);
  });
});
