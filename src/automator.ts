import { chromium } from "playwright";
import { sampleProfile } from "./profile";
import type { ApplicationResult, UserProfile } from "./types";
import { PlatformRegistry } from "./platforms/registry";

/**
 * ============================================================
 * TSENTA TAKE-HOME ASSESSMENT - ATS Form Automator
 * ============================================================
 *
 * This automation system can fill out job application forms
 * across MULTIPLE ATS platforms using Playwright.
 *
 * Architecture:
 *   - Platform Registry: Detects which ATS platform we're on
 *   - Form Handlers: Platform-specific implementations (Acme, Globex)
 *   - Shared Utilities: Common field-filling and human-like behavior
 *
 * To add a new ATS platform:
 *   1. Create a new handler class implementing FormHandler interface
 *   2. Register it in platforms/registry.ts
 *   3. That's it! The registry will automatically detect and use it.
 */

const BASE_URL = "http://localhost:3939";

async function applyToJob(
  url: string,
  profile: UserProfile
): Promise<ApplicationResult> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the form
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    // Find the appropriate handler for this platform
    const registry = new PlatformRegistry();
    const handler = await registry.findHandler(page, url);

    if (!handler) {
      await browser.close();
      return {
        success: false,
        error: `No handler found for URL: ${url}`,
        durationMs: 0,
      };
    }

    // Fill and submit the form
    const result = await handler.fillAndSubmit(page, profile);

    // Keep browser open briefly to see the result
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await browser.close();
    return result;
  } catch (error) {
    await browser.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: 0,
    };
  }
}

// ── Entry point ──────────────────────────────────────────────
async function main() {
  const targets = [
    { name: "Acme Corp", url: `${BASE_URL}/acme.html` },
    { name: "Globex Corporation", url: `${BASE_URL}/globex.html` },
  ];

  for (const target of targets) {
    console.log(`\n--- Applying to ${target.name} ---`);

    try {
      const result = await applyToJob(target.url, sampleProfile);

      if (result.success) {
        console.log(`  Application submitted!`);
        console.log(`  Confirmation: ${result.confirmationId}`);
        console.log(`  Duration: ${result.durationMs}ms`);
      } else {
        console.error(`  Failed: ${result.error}`);
      }
    } catch (err) {
      console.error(`  Fatal error:`, err);
    }
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
