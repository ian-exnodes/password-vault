import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function unlock(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Unlock demo vault" }).click();
  await expect(page.getByRole("heading", { name: "Your vault" })).toBeVisible();
}

test("unlock, search, inspect, copy, favorite, and lock flow", async ({ page }) => {
  await unlock(page);
  await page.getByRole("searchbox", { name: "Search accounts" }).fill("github");
  await expect(page.getByRole("button", { name: "Open GitHub" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Figma" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open GitHub" }).click();
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal GitHub password" }).click();
  await expect(page.getByText("Fixture!GitHub#2026")).toBeVisible();
  await page.getByRole("button", { name: "Copy GitHub password" }).click();
  await expect(page.getByText(/GitHub password copied/)).toHaveText(/Clipboard clear scheduled/);
  await page.getByRole("button", { name: "Close details" }).click();

  await page.getByRole("searchbox", { name: "Search accounts" }).fill("");
  await page.getByRole("button", { name: "Remove GitHub from favorites" }).click();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open GitHub" })).toHaveCount(0);

  await page.locator(".topbar").getByRole("button", { name: "Lock vault" }).click();
  await expect(page.getByRole("heading", { name: /Your digital life/ })).toBeVisible();
});

test("adds a login with a generated password", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "Add login" }).click();
  await page.getByLabel("Name *").fill("Travel card");
  await page.getByLabel("Username or email").fill("traveler@example.test");
  await page.getByRole("button", { name: "Generate password" }).click();
  await page.getByLabel("Website").fill("https://travel.example.test");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Travel card" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal Travel card password" }).click();
  await expect(page.locator(".password-value:not(.password-value--masked)")).not.toBeEmpty();
});

test("primary screens have no serious automated accessibility violations", async ({ page }) => {
  await unlock(page);
  for (const destination of ["Vault", "Favorites", "Generate", "Settings"]) {
    await page.getByRole("button", { name: destination, exact: true }).last().click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
  }
  await page.getByRole("switch", { name: "Dark appearance" }).click();
  const darkResults = await new AxeBuilder({ page }).analyze();
  expect(darkResults.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("layout does not overflow and primary mobile targets are at least 44px", async ({ page }, testInfo) => {
  await unlock(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow, `${testInfo.project.name} has horizontal overflow`).toBe(false);

  if (testInfo.project.name !== "desktop-chromium") {
    const boxes = await page.locator(".bottom-nav .nav-item, .row-action, .fab, .icon-button").evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).display !== "none").map((element) => {
      const box = element.getBoundingClientRect();
      return { label: element.getAttribute("aria-label") ?? element.textContent, width: box.width, height: box.height };
    }));
    expect(boxes.filter((box) => box.width < 44 || box.height < 44)).toEqual([]);
  }
});

test("keyboard activation and dialog escape are supported", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "Open GitHub" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "GitHub" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add login" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "New login" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "New login" })).toHaveCount(0);
});

test("required responsive widths have no horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Run the exact-width matrix once in Chromium");
  await unlock(page);
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `${width}px viewport has horizontal overflow`).toBe(false);
  }
});

test("does not persist or transmit vault secrets from the client session", async ({ page }) => {
  const requestBodies: string[] = [];
  page.on("request", (request) => {
    const body = request.postData();
    if (body) requestBodies.push(body);
  });
  await unlock(page);
  await page.getByRole("button", { name: "Open GitHub" }).click();
  await page.getByRole("button", { name: "Reveal GitHub password" }).click();

  const persisted = await page.evaluate(async () => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    cookies: document.cookie,
    cacheNames: "caches" in window ? await caches.keys() : [],
  }));
  expect(persisted.cacheNames).toEqual([]);
  expect(persisted.local).toEqual({});
  expect(persisted.session).toEqual({});
  expect(persisted.cookies).not.toContain("Fixture!GitHub#2026");
  expect(requestBodies.join("\n")).not.toContain("Fixture!GitHub#2026");
});
