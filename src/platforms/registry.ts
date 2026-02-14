import type { Page } from "playwright";
import type { FormHandler } from "./base-handler";
import { AcmeHandler } from "./acme-handler";
import { GlobexHandler } from "./globex-handler";

/**
 * Registry of all available ATS platform handlers.
 * To add a new platform, create a handler class and register it here.
 */
export class PlatformRegistry {
  private handlers: FormHandler[] = [];

  constructor() {
    // Register all available handlers
    this.handlers = [new AcmeHandler(), new GlobexHandler()];
  }

  /**
   * Find the appropriate handler for the current page.
   * @param page Playwright page object
   * @param url Current page URL
   * @returns Handler that can process this page, or null if none found
   */
  async findHandler(page: Page, url: string): Promise<FormHandler | null> {
    for (const handler of this.handlers) {
      if (await handler.canHandle(page, url)) {
        return handler;
      }
    }
    return null;
  }

  /**
   * Get all registered handlers (for testing/debugging)
   */
  getAllHandlers(): FormHandler[] {
    return [...this.handlers];
  }
}
