import { test, expect } from "@playwright/test";

// These run against the dev cluster (docker/cluster) on :3909 with auth
// disabled. They verify the major new pages render and the admin-token
// CRUD lifecycle works end-to-end through the real Garage admin API.
//
// Selectors are scoped to <main> to avoid strict-mode clashes with the
// sidebar nav links and the header H1 that repeat the same labels.

test("dashboard renders cluster health + live metrics", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByText("Healthy").first()).toBeVisible();
  await expect(main.getByText("Live Metrics")).toBeVisible();
  await expect(main.getByText("S3 Speedtest")).toBeVisible();
});

test("sidebar navigates to all new admin pages", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  const nav = page.getByRole("complementary").or(page.locator("aside")).first();

  await nav.getByRole("link", { name: "Layout" }).click();
  await expect(main.getByRole("heading", { name: "Cluster Layout" })).toBeVisible();

  await nav.getByRole("link", { name: "Workers" }).click();
  await expect(main.getByRole("heading", { name: "Workers" })).toBeVisible();

  await nav.getByRole("link", { name: "Block Errors" }).click();
  await expect(main.getByRole("heading", { name: "Block Errors" })).toBeVisible();

  await nav.getByRole("link", { name: "Admin Tokens" }).click();
  await expect(main.getByRole("heading", { name: "Admin Tokens" })).toBeVisible();
});

test("layout page shows current roles and danger zone", async ({ page }) => {
  await page.goto("/cluster/layout");
  const main = page.getByRole("main");
  await expect(main.getByText(/Current Roles/)).toBeVisible();
  await expect(main.getByText("Danger Zone")).toBeVisible();
  await expect(main.getByRole("button", { name: /Skip Dead Nodes/ })).toBeVisible();
});

test("admin token create -> list -> delete lifecycle", async ({ page }) => {
  const tokenName = `e2e-pw-${Date.now()}`;
  await page.goto("/admin-tokens");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Admin Tokens" })).toBeVisible();

  await main.getByRole("button", { name: "New Token" }).click();
  await page.getByPlaceholder("ci-deploy-token").fill(tokenName);
  await page.getByRole("button", { name: "Create" }).click();

  // Secret reveal modal appears once.
  await expect(page.getByRole("heading", { name: "Token Created" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  // Token now in the list.
  await expect(main.getByText(tokenName)).toBeVisible();

  // Delete it.
  const row = page.locator("tr", { hasText: tokenName });
  await row.getByTitle("Delete token").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(main.getByText(tokenName)).toHaveCount(0);
});
