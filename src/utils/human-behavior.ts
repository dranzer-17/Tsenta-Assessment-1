import type { Page, Locator } from "playwright";

/**
 * Human-like behavior utilities to make automation more realistic
 * and avoid bot detection.
 */

/**
 * Random delay between min and max milliseconds
 */
export async function randomDelay(min: number = 100, max: number = 500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Variable-speed typing: faster for common words, slower for numbers/special chars
 */
export async function humanType(
  locator: Locator,
  text: string,
  options?: { delay?: number }
): Promise<void> {
  await locator.click();
  await randomDelay(50, 150);

  for (const char of text) {
    const baseDelay = options?.delay ?? 50;
    
    // Faster for letters (especially common ones)
    if (/[a-zA-Z\s]/.test(char)) {
      const delay = baseDelay + Math.random() * 30; // 50-80ms for letters
      await locator.type(char, { delay });
    }
    // Slower for numbers
    else if (/[0-9]/.test(char)) {
      const delay = baseDelay + 50 + Math.random() * 50; // 100-150ms for numbers
      await locator.type(char, { delay });
    }
    // Slowest for special characters
    else {
      const delay = baseDelay + 100 + Math.random() * 100; // 150-250ms for special chars
      await locator.type(char, { delay });
    }
    
    // Occasional micro-pauses (like humans do)
    if (Math.random() < 0.1) {
      await randomDelay(100, 300);
    }
  }
}

/**
 * Hover over an element before clicking (more human-like)
 */
export async function hoverAndClick(locator: Locator): Promise<void> {
  await locator.hover();
  await randomDelay(100, 300);
  await locator.click();
}

/**
 * Simulate reading pause - wait a bit longer as if reading content
 */
export async function readingPause(min: number = 500, max: number = 1500): Promise<void> {
  await randomDelay(min, max);
}

/**
 * Smooth scroll to an element
 */
export async function smoothScrollTo(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(200, 400);
}

/**
 * Simulate human-like form interaction flow
 */
export async function humanFormInteraction(
  page: Page,
  action: () => Promise<void>
): Promise<void> {
  await randomDelay(200, 500);
  await action();
  await randomDelay(100, 300);
}
