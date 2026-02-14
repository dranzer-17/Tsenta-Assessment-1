import type { Page } from "playwright";
import type { UserProfile, ApplicationResult } from "../types";

/**
 * Base interface for all ATS platform handlers.
 * Each platform (Acme, Globex, etc.) implements this interface.
 */
export interface FormHandler {
  /**
   * Detect if this handler can process the current page.
   * @param page Playwright page object
   * @param url Current page URL
   */
  canHandle(page: Page, url: string): Promise<boolean>;

  /**
   * Fill out the entire form and submit it.
   * @param page Playwright page object
   * @param profile Candidate profile data
   * @returns Application result with confirmation ID
   */
  fillAndSubmit(page: Page, profile: UserProfile): Promise<ApplicationResult>;
}
