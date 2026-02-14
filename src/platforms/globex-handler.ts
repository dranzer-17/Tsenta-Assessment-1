import type { Page } from "playwright";
import type { UserProfile, ApplicationResult } from "../types";
import type { FormHandler } from "./base-handler";
import {
  fillTextInput,
  fillTextarea,
  selectOption,
  uploadFile,
  fillDateInput,
  setSliderValue,
} from "../utils/field-fillers";
import { randomDelay, readingPause, smoothScrollTo, hoverAndClick } from "../utils/human-behavior";
import path from "path";

/**
 * Handler for Globex Corporation accordion form
 */
export class GlobexHandler implements FormHandler {
  async canHandle(page: Page, url: string): Promise<boolean> {
    return url.includes("/globex.html") || (await page.title()).includes("Globex");
  }

  async fillAndSubmit(page: Page, profile: UserProfile): Promise<ApplicationResult> {
    const startTime = Date.now();

    try {
      // Expand and fill Contact Details section
      await this.expandSection(page, "contact");
      await this.fillContactDetails(page, profile);
      await readingPause(300, 600);

      // Expand and fill Qualifications section
      await this.expandSection(page, "qualifications");
      await this.fillQualifications(page, profile);
      await readingPause(300, 600);

      // Expand and fill Additional Information section
      await this.expandSection(page, "additional");
      await this.fillAdditionalInfo(page, profile);
      await readingPause(500, 1000);

      // Submit form
      await this.submitForm(page);

      // Wait for confirmation and extract reference number
      await page.waitForSelector("#globex-ref", { timeout: 10000 });
      const confirmationId = await page.textContent("#globex-ref");

      return {
        success: true,
        confirmationId: confirmationId?.trim() || undefined,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async expandSection(page: Page, sectionName: string): Promise<void> {
    const section = page.locator(`[data-section="${sectionName}"]`);
    const header = section.locator(".section-header");
    
    await smoothScrollTo(page, header);
    await randomDelay(200, 400);
    
    // Check if already open
    const isOpen = await header.evaluate((el) => el.classList.contains("open"));
    if (!isOpen) {
      await hoverAndClick(header);
      await randomDelay(300, 500); // Wait for accordion animation
    }
  }

  private async fillContactDetails(page: Page, profile: UserProfile): Promise<void> {
    await fillTextInput(page.locator("#g-fname"), profile.firstName);
    await fillTextInput(page.locator("#g-lname"), profile.lastName);
    await fillTextInput(page.locator("#g-email"), profile.email);
    await fillTextInput(page.locator("#g-phone"), profile.phone);

    // Location - extract city from location string
    const city = profile.location.split(",")[0].trim();
    await fillTextInput(page.locator("#g-city"), city);

    if (profile.linkedIn) {
      await fillTextInput(page.locator("#g-linkedin"), profile.linkedIn);
    }

    if (profile.portfolio) {
      await fillTextInput(page.locator("#g-website"), profile.portfolio);
    }
  }

  private async fillQualifications(page: Page, profile: UserProfile): Promise<void> {
    // Upload resume - resolve relative to project root
    const resumePath = path.join(process.cwd(), "fixtures", "sample-resume.pdf");
    await uploadFile(page.locator("#g-resume"), resumePath);

    // Experience level - map to Globex values
    const experienceMap: Record<string, string> = {
      "0-1": "intern",
      "1-3": "junior",
      "3-5": "mid",
      "5-10": "senior",
      "10+": "staff",
    };
    const experienceValue = experienceMap[profile.experienceLevel] || "intern";
    await selectOption(page.locator("#g-experience"), experienceValue);

    // Degree - map to Globex values
    const degreeMap: Record<string, string> = {
      "high-school": "hs",
      "associates": "assoc",
      "bachelors": "bs",
      "masters": "ms",
      "phd": "phd",
    };
    const degreeValue = degreeMap[profile.education] || "bs";
    await selectOption(page.locator("#g-degree"), degreeValue);

    // University async typeahead
    await this.fillAsyncTypeahead(page, profile.school);

    // Skills chips
    await this.selectSkillChips(page, profile.skills);
  }

  private async fillAsyncTypeahead(page: Page, schoolName: string): Promise<void> {
    const schoolInput = page.locator("#g-school");
    await schoolInput.scrollIntoViewIfNeeded();
    await randomDelay(100, 200);
    await schoolInput.click();
    await randomDelay(100, 200);

    // Type the school name
    await fillTextInput(schoolInput, schoolName, false);

    // Wait for spinner to appear (indicates async request started)
    await page.waitForSelector("#g-school-spinner.loading", { timeout: 2000 }).catch(() => {});

    // Wait for results to appear (they come after network delay, shuffled)
    // We need to wait for the results list to have items
    await page.waitForFunction(
      () => {
        const results = document.querySelector("#g-school-results");
        return results && results.classList.contains("open") && results.querySelectorAll("li:not(.typeahead-no-results)").length > 0;
      },
      { timeout: 5000 }
    );

    await randomDelay(200, 400);

    // Find and click the matching result (results are shuffled, so we need to search)
    const results = page.locator("#g-school-results li:not(.typeahead-no-results)");
    const count = await results.count();

    // Try to find exact match first
    let found = false;
    for (let i = 0; i < count; i++) {
      const text = await results.nth(i).textContent();
      if (text && text.toLowerCase().includes(schoolName.toLowerCase())) {
        await hoverAndClick(results.nth(i));
        found = true;
        break;
      }
    }

    // If no exact match, click first result
    if (!found && count > 0) {
      await hoverAndClick(results.first());
    }

    await randomDelay(200, 400);
  }

  private async selectSkillChips(page: Page, skills: string[]): Promise<void> {
    // Map profile skills to Globex chip data-skill values
    const skillMap: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      react: "react",
      nodejs: "node",
      "node.js": "node",
      sql: "sql",
      git: "git",
      docker: "docker",
    };

    for (const skill of skills) {
      const normalizedSkill = skill.toLowerCase().trim();
      const chipValue = skillMap[normalizedSkill];
      if (chipValue) {
        const chip = page.locator(`#g-skills .chip[data-skill="${chipValue}"]`);
        await chip.scrollIntoViewIfNeeded();
        await randomDelay(100, 200);
        
        // Check if already selected
        const isSelected = await chip.evaluate((el) => el.classList.contains("selected"));
        if (!isSelected) {
          await hoverAndClick(chip);
        }
      }
    }
  }

  private async fillAdditionalInfo(page: Page, profile: UserProfile): Promise<void> {
    // Work authorization toggle
    const workAuthToggle = page.locator("#g-work-auth-toggle");
    await smoothScrollTo(page, workAuthToggle);
    await randomDelay(100, 200);
    
    const isAuthorized = profile.workAuthorized;
    const currentValue = await workAuthToggle.evaluate((el) => el.dataset.value === "true");
    
    if (isAuthorized !== currentValue) {
      await hoverAndClick(workAuthToggle);
      await randomDelay(300, 500); // Wait for conditional block to appear
    }

    // Visa sponsorship (only if work authorized)
    if (isAuthorized) {
      await page.waitForSelector("#g-visa-block.visible", { timeout: 2000 }).catch(() => {});
      const visaToggle = page.locator("#g-visa-toggle");
      const visaValue = await visaToggle.evaluate((el) => el.dataset.value === "true");
      
      if (profile.requiresVisa !== visaValue) {
        await hoverAndClick(visaToggle);
        await randomDelay(200, 400);
      }
    }

    // Start date
    await fillDateInput(page.locator("#g-start-date"), profile.earliestStartDate);

    // Salary slider
    if (profile.salaryExpectation) {
      const salary = parseInt(profile.salaryExpectation);
      if (!isNaN(salary)) {
        await setSliderValue(page.locator("#g-salary"), salary);
      }
    }

    // Referral source
    await this.selectReferralSource(page, profile.referralSource);

    // Motivation textarea - adapt cover letter for Globex
    const motivation = this.adaptCoverLetter(profile.coverLetter, "Globex Corporation");
    await fillTextarea(page.locator("#g-motivation"), motivation);
  }

  private async selectReferralSource(page: Page, source: string): Promise<void> {
    const sourceMap: Record<string, string> = {
      linkedin: "linkedin",
      "company-website": "website",
      "job-board": "board",
      referral: "referral",
      university: "university",
      other: "other",
    };

    const normalizedSource = source.toLowerCase().trim();
    const formValue = sourceMap[normalizedSource] || "linkedin";
    await selectOption(page.locator("#g-source"), formValue);

    // Handle "other" option
    if (formValue === "other") {
      await page.waitForSelector("#g-source-other-block.visible", { timeout: 2000 });
      await randomDelay(200, 400);
      await fillTextInput(page.locator("#g-source-other"), source);
    }
  }

  private async submitForm(page: Page): Promise<void> {
    // Check consent checkbox
    const consentCheckbox = page.locator("#g-consent");
    await smoothScrollTo(page, consentCheckbox);
    await randomDelay(200, 400);
    await consentCheckbox.check();
    await randomDelay(200, 400);

    // Click submit button
    const submitButton = page.locator("#globex-submit");
    await smoothScrollTo(page, submitButton);
    await randomDelay(500, 1000);
    await hoverAndClick(submitButton);
    await randomDelay(1000, 2000); // Wait for submission
  }

  private adaptCoverLetter(coverLetter: string, companyName: string): string {
    // Replace any existing company name with the target company
    return coverLetter
      .replace(/Acme Corp/g, companyName)
      .replace(/Globex Corporation/g, companyName)
      .replace(/Globex/g, companyName);
  }
}
