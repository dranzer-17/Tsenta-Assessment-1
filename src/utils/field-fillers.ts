import type { Page, Locator } from "playwright";
import { humanType, hoverAndClick, randomDelay } from "./human-behavior";

/**
 * Shared utilities for filling common form field types
 */

/**
 * Fill a text input field with human-like typing
 */
export async function fillTextInput(
  locator: Locator,
  value: string,
  clearFirst: boolean = true
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(100, 200);
  
  if (clearFirst) {
    await locator.click({ clickCount: 3 }); // Select all
    await randomDelay(50, 100);
  }
  
  await humanType(locator, value);
}

/**
 * Fill a textarea with human-like typing
 */
export async function fillTextarea(
  locator: Locator,
  value: string
): Promise<void> {
  await fillTextInput(locator, value);
}

/**
 * Select an option from a dropdown/select element
 */
export async function selectOption(
  locator: Locator,
  value: string
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(100, 200);
  await hoverAndClick(locator);
  await randomDelay(100, 200);
  await locator.selectOption(value);
  await randomDelay(100, 200);
}

/**
 * Select an option by matching text (fuzzy matching for different label formats)
 */
export async function selectOptionByText(
  locator: Locator,
  searchText: string,
  options: string[]
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(100, 200);
  await hoverAndClick(locator);
  await randomDelay(100, 200);
  
  // Find the best matching option
  const normalizedSearch = searchText.toLowerCase().trim();
  const match = options.find((opt) => {
    const normalized = opt.toLowerCase();
    return (
      normalized === normalizedSearch ||
      normalized.includes(normalizedSearch) ||
      normalizedSearch.includes(normalized.split(" ")[0]) // Match first word
    );
  });
  
  if (match) {
    await locator.selectOption({ label: match });
  } else {
    // Fallback: try direct value match
    await locator.selectOption(searchText);
  }
  
  await randomDelay(100, 200);
}

/**
 * Check a checkbox
 */
export async function checkCheckbox(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(100, 200);
  const isChecked = await locator.isChecked();
  if (!isChecked) {
    await hoverAndClick(locator);
  }
}

/**
 * Click a radio button
 */
export async function clickRadio(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(100, 200);
  await hoverAndClick(locator);
}

/**
 * Upload a file
 */
export async function uploadFile(
  locator: Locator,
  filePath: string
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(200, 400);
  await locator.setInputFiles(filePath);
  await randomDelay(300, 600); // Wait for file to process
}

/**
 * Fill a date input
 */
export async function fillDateInput(
  locator: Locator,
  dateString: string // YYYY-MM-DD format
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(100, 200);
  await locator.fill(dateString);
  await randomDelay(100, 200);
}

/**
 * Set a range slider value
 */
export async function setSliderValue(
  locator: Locator,
  value: number
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await randomDelay(100, 200);
  // For range inputs, we need to set the value property directly
  await locator.evaluate((el, val) => {
    (el as HTMLInputElement).value = val.toString();
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await randomDelay(200, 400);
}
