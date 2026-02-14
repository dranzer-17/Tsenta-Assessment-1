import type { Page } from "playwright";
import type { UserProfile, ApplicationResult } from "../types";
import type { FormHandler } from "./base-handler";
import {
  fillTextInput,
  fillTextarea,
  selectOption,
  checkCheckbox,
  clickRadio,
  uploadFile,
  fillDateInput,
} from "../utils/field-fillers";
import { randomDelay, readingPause, smoothScrollTo, hoverAndClick } from "../utils/human-behavior";
import path from "path";

/**
 * Handler for Acme Corp multi-step form
 */
export class AcmeHandler implements FormHandler {
  async canHandle(page: Page, url: string): Promise<boolean> {
    return url.includes("/acme.html") || (await page.title()).includes("Acme");
  }

  async fillAndSubmit(page: Page, profile: UserProfile): Promise<ApplicationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Personal Information
      await this.fillStep1(page, profile);
      await this.clickNext(page);
      await readingPause(500, 1000);

      // Step 2: Experience & Education
      await this.fillStep2(page, profile);
      await this.clickNext(page);
      await readingPause(500, 1000);

      // Step 3: Additional Questions
      await this.fillStep3(page, profile);
      await this.clickNext(page);
      await readingPause(1000, 2000); // Longer pause before review

      // Step 4: Review & Submit
      await this.fillStep4(page);
      await this.submitForm(page);

      // Wait for success page and extract confirmation ID
      await page.waitForSelector("#confirmation-id", { timeout: 10000 });
      const confirmationId = await page.textContent("#confirmation-id");

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

  private async fillStep1(page: Page, profile: UserProfile): Promise<void> {
    await fillTextInput(page.locator("#first-name"), profile.firstName);
    await fillTextInput(page.locator("#last-name"), profile.lastName);
    await fillTextInput(page.locator("#email"), profile.email);
    await fillTextInput(page.locator("#phone"), profile.phone);
    await fillTextInput(page.locator("#location"), profile.location);

    if (profile.linkedIn) {
      await fillTextInput(page.locator("#linkedin"), profile.linkedIn);
    }

    if (profile.portfolio) {
      await fillTextInput(page.locator("#portfolio"), profile.portfolio);
    }
  }

  private async fillStep2(page: Page, profile: UserProfile): Promise<void> {
    // Upload resume - resolve relative to project root
    const resumePath = path.join(process.cwd(), "fixtures", "sample-resume.pdf");
    await uploadFile(page.locator("#resume"), resumePath);

    // Experience level
    await selectOption(page.locator("#experience-level"), profile.experienceLevel);

    // Education level - map profile value to form value
    const educationMap: Record<string, string> = {
      "high-school": "high-school",
      "associates": "associates",
      "bachelors": "bachelors",
      "masters": "masters",
      "phd": "phd",
    };
    const educationValue = educationMap[profile.education] || "bachelors";
    await selectOption(page.locator("#education"), educationValue);

    // School typeahead
    await this.fillSchoolTypeahead(page, profile.school);

    // Skills checkboxes
    await this.selectSkills(page, profile.skills);
  }

  private async fillSchoolTypeahead(page: Page, schoolName: string): Promise<void> {
    const schoolInput = page.locator("#school");
    await schoolInput.scrollIntoViewIfNeeded();
    await randomDelay(100, 200);
    await schoolInput.click();
    await randomDelay(100, 200);

    // Type the school name
    await fillTextInput(schoolInput, schoolName, false);

    // Wait for dropdown to appear
    await page.waitForSelector("#school-dropdown:has(li)", { timeout: 3000 }).catch(() => {});

    // Wait a bit for results to populate
    await randomDelay(300, 500);

    // Click the first matching result
    const dropdown = page.locator("#school-dropdown li").first();
    const count = await dropdown.count();
    if (count > 0) {
      await hoverAndClick(dropdown);
    } else {
      // If no dropdown results, the typed value should work
      await schoolInput.press("Enter");
    }

    await randomDelay(200, 400);
  }

  private async selectSkills(page: Page, skills: string[]): Promise<void> {
    // Map profile skills to form checkbox values
    const skillMap: Record<string, string> = {
      javascript: "javascript",
      typescript: "typescript",
      python: "python",
      react: "react",
      nodejs: "nodejs",
      "node.js": "nodejs",
      sql: "sql",
      git: "git",
      docker: "docker",
    };

    for (const skill of skills) {
      const normalizedSkill = skill.toLowerCase().trim();
      const formValue = skillMap[normalizedSkill];
      if (formValue) {
        const checkbox = page.locator(`input[name="skills"][value="${formValue}"]`);
        await checkCheckbox(checkbox);
      }
    }
  }

  private async fillStep3(page: Page, profile: UserProfile): Promise<void> {
    // Work authorization
    const workAuthValue = profile.workAuthorized ? "yes" : "no";
    await clickRadio(page.locator(`input[name="workAuth"][value="${workAuthValue}"]`));

    // Wait for conditional visa field to appear if work authorized
    if (profile.workAuthorized) {
      await page.waitForSelector("#visa-sponsorship-group", { state: "visible", timeout: 2000 });
      await randomDelay(200, 400);
      const visaValue = profile.requiresVisa ? "yes" : "no";
      await clickRadio(page.locator(`input[name="visaSponsorship"][value="${visaValue}"]`));
    }

    // Start date
    await fillDateInput(page.locator("#start-date"), profile.earliestStartDate);

    // Salary expectation (optional)
    if (profile.salaryExpectation) {
      await fillTextInput(page.locator("#salary-expectation"), profile.salaryExpectation);
    }

    // Referral source
    await this.selectReferralSource(page, profile.referralSource);

    // Cover letter - adapt for Acme
    const coverLetter = this.adaptCoverLetter(profile.coverLetter, "Acme Corp");
    await fillTextarea(page.locator("#cover-letter"), coverLetter);

    // Skip optional demographics
  }

  private async selectReferralSource(page: Page, source: string): Promise<void> {
    const sourceMap: Record<string, string> = {
      linkedin: "linkedin",
      "company-website": "company-website",
      "job-board": "job-board",
      referral: "referral",
      university: "university",
      other: "other",
    };

    const normalizedSource = source.toLowerCase().trim();
    const formValue = sourceMap[normalizedSource] || "linkedin";
    await selectOption(page.locator("#referral"), formValue);

    // Handle "other" option
    if (formValue === "other") {
      await page.waitForSelector("#referral-other-group", { state: "visible", timeout: 2000 });
      await randomDelay(200, 400);
      await fillTextInput(page.locator("#referral-other"), source);
    }
  }

  private async fillStep4(page: Page): Promise<void> {
    // Check terms checkbox
    await checkCheckbox(page.locator("#terms-agree"));
  }

  private async clickNext(page: Page): Promise<void> {
    // Get current step number
    const currentStepEl = page.locator(".form-step.active");
    const currentStepNum = await currentStepEl.getAttribute("data-step");
    const nextStepNum = currentStepNum ? parseInt(currentStepNum) + 1 : 1;

    // Only target the Continue button in the active step (to avoid strict mode violation)
    const nextButton = currentStepEl.locator("button.btn-primary:has-text('Continue')");
    await smoothScrollTo(page, nextButton);
    await randomDelay(200, 400);
    await nextButton.click();
    
    // Wait for the next step to become active
    await page.waitForSelector(`.form-step[data-step="${nextStepNum}"].active`, { timeout: 3000 });
    await randomDelay(300, 600); // Additional delay for animations
  }

  private async submitForm(page: Page): Promise<void> {
    const submitButton = page.locator("#submit-btn");
    await smoothScrollTo(page, submitButton);
    await randomDelay(500, 1000);
    await submitButton.click();
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
