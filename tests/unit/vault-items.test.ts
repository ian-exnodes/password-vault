import { describe, expect, it } from "vitest";
import { filterItems, fixtureItems, type VaultItem } from "@/lib/vault-items";

describe("filterItems", () => {
  it("searches titles, usernames, URLs, and tags without case sensitivity", () => {
    expect(filterItems(fixtureItems, "GITHUB", "All").map((item) => item.id)).toEqual(["github"]);
    expect(filterItems(fixtureItems, "design@", "All").map((item) => item.id)).toEqual(["figma"]);
    expect(filterItems(fixtureItems, "mail.proton", "All").map((item) => item.id)).toEqual(["mail"]);
    expect(filterItems(fixtureItems, "media", "All").map((item) => item.id)).toEqual(["spotify"]);
  });

  it("combines query and tag filters", () => {
    expect(filterItems(fixtureItems, "example", "Work").map((item) => item.id)).toEqual(["figma", "notion"]);
  });

  it("filters 1,000 fixture records below the 100 ms Phase 1 budget", () => {
    const records: VaultItem[] = Array.from({ length: 1_000 }, (_, index) => ({
      ...fixtureItems[index % fixtureItems.length],
      id: `fixture-${index}`,
      title: `Fixture account ${index}`,
    }));
    const durations: number[] = [];
    for (let run = 0; run < 100; run += 1) {
      const started = performance.now();
      filterItems(records, "account 999", "All");
      durations.push(performance.now() - started);
    }
    durations.sort((a, b) => a - b);
    expect(durations[Math.floor(durations.length * 0.95)]).toBeLessThan(100);
  });
});
