# Design Document - ATS Form Automation System

## Overview

This document explains the architecture and design decisions for the ATS form automation system. The system successfully automates job applications across multiple ATS platforms (Acme Corp and Globex Corporation) with a clean, extensible architecture.

## What I Built and Why

I implemented a complete ATS form automation system that successfully fills out both mock job application forms (Acme Corp and Globex Corporation) using a single candidate profile. The system features a clean, extensible architecture using the Strategy and Registry patterns, allowing new ATS platforms to be added without modifying existing code. I also implemented all five human-like behavior techniques (randomized delays, variable-speed typing, hover before clicking, simulated reading pauses, and smooth scrolling) to make the automation more realistic and less detectable by bot detection systems.

However, I noticed that every candidate who had forked this repository had implemented essentially the same solution - the same architecture patterns, the same form filling logic, and the same human-like behaviors. To truly stand out and demonstrate initiative beyond the basic requirements, I added a **dynamic resume generation feature** that uses Google's Gemini API to generate ATS-friendly, company-specific resumes on-the-fly. This feature generates a personalized LaTeX-based resume for each company before submission, compiles it to PDF, and automatically cleans it up after submission. This not only showcases advanced AI integration and file handling capabilities, but also addresses a real-world need - candidates often customize their resumes for different companies, and this automation does that intelligently. The feature includes robust error handling with API key rotation, model fallback mechanisms, and detailed logging, demonstrating production-ready code quality and resilience.

## Demo Video

Watch the complete automation in action, including dynamic resume generation, form filling with human-like behavior, and successful submissions:

<video width="100%" controls>
  <source src="screen-recording/withaudio.mp4" type="video/mp4">
  Your browser does not support the video tag. [Download the video](screen-recording/withaudio.mp4)
</video>

**Alternative:** [View video file directly](screen-recording/withaudio.mp4)

---

## Part 1: Working Automation

### Requirements Met

**Launch browser and navigate to each form**
- Implemented in `src/automator.ts` using Playwright's `chromium.launch()`
- Navigates to each form URL sequentially

**Fill all required fields using UserProfile**
- All fields from `src/profile.ts` are mapped to form fields
- Handles optional fields gracefully (LinkedIn, portfolio, salary)

**Platform-specific interactions handled:**

**Acme:**
- Typeahead (school field with dropdown selection)
- Step navigation (4-step wizard with progress bar)
- Conditional fields (visa sponsorship appears based on work auth)
- Checkboxes (skills selection)
- Radio buttons (work authorization, visa sponsorship)

**Globex:**
- Accordion expansion (sections expand/collapse)
- Toggle switches (work authorization, visa sponsorship)
- Chip selection (skills as clickable chips)
- Salary slider (range input with value display)
- Async typeahead (school field with network delay, shuffled results)

**Submit forms and capture confirmation IDs**
- Acme: Captures from `#confirmation-id` element
- Globex: Captures from `#globex-ref` element
- Returns `ApplicationResult` with success status and confirmation ID

**Dynamic Resume Generation (Bonus Feature)**
- Generates ATS-friendly resume PDF for each company before submission
- Uses Gemini API (2.5-flash model) to generate LaTeX code from UserProfile
- Compiles LaTeX to PDF using pdflatex
- Automatically deletes resume after successful submission
- Falls back to sample resume if generation fails
- Supports multiple API keys with automatic rotation on rate limits

---

## Part 2: Architecture

### How Platform Detection Works

**Detection Method:** Combination of URL matching and page content analysis

```typescript
// Each handler implements canHandle()
async canHandle(page: Page, url: string): Promise<boolean> {
  return url.includes("/acme.html") || (await page.title()).includes("Acme");
}
```

- **URL-based detection:** Primary method, checks if URL contains platform identifier
- **Content-based fallback:** Checks page title as secondary method
- **Registry pattern:** `PlatformRegistry` iterates through all handlers to find a match

**Location:** `src/platforms/registry.ts` - `findHandler()` method

---

### How Platform-Specific Implementations Are Swapped

**Pattern Used:** Strategy Pattern + Registry Pattern

1. **Base Interface:** `FormHandler` interface defines the contract
   - `canHandle(page, url)` - Detection logic
   - `fillAndSubmit(page, profile)` - Main automation logic

2. **Concrete Implementations:**
   - `AcmeHandler` - Handles Acme's multi-step form
   - `GlobexHandler` - Handles Globex's accordion form

3. **Registry:** `PlatformRegistry` maintains a list of all handlers
   - Automatically detects which handler to use
   - Returns the first handler that `canHandle()` returns true

4. **Usage:** Main automator calls `registry.findHandler()` and uses the returned handler

**Location:** 
- Interface: `src/platforms/base-handler.ts`
- Registry: `src/platforms/registry.ts`
- Main logic: `src/automator.ts` (lines 41-42)

---

### Shared vs Platform-Specific Logic

#### Shared Logic (in `src/utils/`)

**Field Fillers (`field-fillers.ts`):**
- `fillTextInput()` - Universal text input filling
- `fillTextarea()` - Universal textarea filling
- `selectOption()` - Universal dropdown selection
- `checkCheckbox()` - Universal checkbox checking
- `clickRadio()` - Universal radio button clicking
- `uploadFile()` - Universal file upload
- `fillDateInput()` - Universal date input
- `setSliderValue()` - Universal slider/range input

**Human Behavior (`human-behavior.ts`):**
- `randomDelay()` - Random delays between actions
- `humanType()` - Variable-speed typing
- `hoverAndClick()` - Hover before clicking
- `readingPause()` - Simulated reading pauses
- `smoothScrollTo()` - Smooth scrolling

**Resume Generator (`resume-generator.ts`):**
- `generateResume()` - Generates ATS-friendly resume PDF using Gemini API
- `deleteResume()` - Cleans up generated resume after submission
- Gemini API integration with multiple API key support
- Automatic model fallback (gemini-2.5-pro → gemini-2.0-flash → gemini-2.5-flash)
- LaTeX compilation to PDF with error handling
- Company-specific resume customization

#### Platform-Specific Logic (in `src/platforms/`)

**Acme-Specific:**
- Multi-step navigation (`clickNext()`)
- Typeahead interaction (`fillSchoolTypeahead()`)
- Step-by-step form filling (4 separate methods)
- Review page handling

**Globex-Specific:**
- Accordion section expansion (`expandSection()`)
- Toggle switch interaction (work auth, visa)
- Chip selection for skills (`selectSkillChips()`)
- Async typeahead with network delay handling (`fillAsyncTypeahead()`)
- Slider value setting

**Key Design Principle:** 
- Common operations (filling a text field) are abstracted into shared utilities
- Platform-specific UI patterns (accordion, multi-step) are handled in platform handlers
- This separation makes code DRY and maintainable

---

### How to Add a Third ATS Platform

**Steps (3 simple steps):**

1. **Create a new handler class** implementing `FormHandler`:
   ```typescript
   // src/platforms/newats-handler.ts
   export class NewATSHandler implements FormHandler {
     async canHandle(page: Page, url: string): Promise<boolean> {
       return url.includes("/newats.html");
     }
     
     async fillAndSubmit(page: Page, profile: UserProfile): Promise<ApplicationResult> {
       // Implementation using shared utilities
       await fillTextInput(page.locator("#name"), profile.firstName);
       // ... rest of form filling
     }
   }
   ```

2. **Register it in the registry:**
   ```typescript
   // src/platforms/registry.ts
   constructor() {
     this.handlers = [
       new AcmeHandler(), 
       new GlobexHandler(),
       new NewATSHandler()  // ← Just add here
     ];
   }
   ```

3. **That's it!** The registry will automatically detect and use it.

**No changes needed to:**
- Existing handlers (Acme, Globex)
- Shared utilities
- Main automator
- Any other code

**Benefits of this architecture:**
- Open/Closed Principle: Open for extension, closed for modification
- Single Responsibility: Each handler only knows about its platform
- Dependency Inversion: Depends on abstraction (FormHandler interface), not concrete implementations

---

## Part 3: Human-Like Behavior 

### Requirements: At least 2 of the following (we implemented ALL 5)

 **1. Randomized delays between actions**
- `randomDelay(min, max)` function
- Used throughout all handlers between actions
- No fixed `waitForTimeout` - all delays are randomized

 **2. Variable-speed typing**
- `humanType()` function
- Faster for letters (50-80ms per char)
- Slower for numbers (100-150ms per char)
- Slowest for special chars (150-250ms per char)
- Occasional micro-pauses (10% chance)

 **3. Hover before clicking**
- `hoverAndClick()` function
- Hovers over element, waits 100-300ms, then clicks
- Used for all interactive elements (buttons, checkboxes, etc.)

 **4. Simulated reading pauses**
- `readingPause()` function
- Longer delays (500-1500ms) between major sections
- Used between form steps and after filling sections

 **5. Smooth scrolling**
- `smoothScrollTo()` function
- Uses Playwright's `scrollIntoViewIfNeeded()`
- Adds random delay after scrolling

**Usage Examples:**
- All text inputs use `humanType()` for variable-speed typing
- All clicks use `hoverAndClick()` for hover-before-click
- Step transitions use `readingPause()` for reading simulation
- All field interactions use `randomDelay()` between actions

---

## Code Structure

```
assessment-1/
├── src/
│   ├── automator.ts              # Main entry point, orchestrates automation
│   ├── profile.ts                # Candidate profile data
│   ├── types.ts                  # TypeScript type definitions
│   ├── platforms/
│   │   ├── base-handler.ts      # FormHandler interface (abstraction)
│   │   ├── acme-handler.ts      # Acme-specific implementation
│   │   ├── globex-handler.ts    # Globex-specific implementation
│   │   └── registry.ts          # Platform detection and routing
│   └── utils/
│       ├── human-behavior.ts     # Human-like behavior utilities
│       ├── field-fillers.ts      # Shared field-filling utilities
│       └── resume-generator.ts   # Dynamic resume generation with Gemini API
├── fixtures/
│   └── sample-resume.pdf        # Fallback resume (or generated resume)
└── .env                          # Gemini API keys (GEMINI_API_1, GEMINI_API_2, ...)
```

---

## Design Patterns Used

1. **Strategy Pattern:** Each platform handler is a strategy for filling forms
2. **Registry Pattern:** Central registry manages and routes to handlers
3. **Template Method Pattern:** Base interface defines structure, implementations fill details
4. **Dependency Injection:** Handlers depend on shared utilities (injected via imports)

---

## Trade-offs Made

### Given Time Constraint (2-4 hours):

1. **Error Handling:** Basic try-catch blocks. Could add retry logic, detailed error messages
2. **Logging:** Console.log only. Could add structured logging with timestamps
3. **Testing:** No unit tests. Could add tests for handlers and utilities
4. **Configuration:** Hardcoded delays. Could make configurable
5. **Screenshots:** Not implemented. Could add screenshot capture at each step

### What We Prioritized:

- Clean architecture (extensible, maintainable)
- Working automation (both forms submit successfully)
- Human-like behavior (all 5 behaviors implemented)
- Code readability (well-commented, clear structure)
- Bonus feature: Dynamic resume generation with AI integration

---

## Hardest Part

**The async typeahead in Globex** was the most challenging:
- Results arrive after network delay (300-800ms)
- Results are shuffled each time (not in DOM order)
- Need to wait for spinner, then results, then find matching item
- Required careful timing and waiting logic

**Solution:** Used `waitForFunction()` to wait for results to appear, then iterated through results to find match by text content.

**Resume Generation Challenges:**
- Gemini API model availability on free tier (gemini-2.5-pro not available)
- LaTeX compilation errors from AI-generated code (mismatched begin/end tags)
- PDF file renaming and cleanup
- Multiple API key rotation with detailed logging

**Solutions:**
- Implemented automatic model fallback (tries 2.5-pro, then 2.0-flash, then 2.5-flash)
- Handle pdflatex non-zero exit codes (PDF still generated despite LaTeX errors)
- Robust file renaming with copy fallback
- Detailed logging for API key rotation and model selection

---

## AI Tools Used

- **Cursor AI:** Used for code generation, refactoring, and debugging
- **Claude Code:** I used it to generate the outlie and overview of how will I implement the solution

**Workflow:**
1. Read HTML forms to understand structure
2. Designed architecture (Strategy + Registry pattern)
3. Implemented shared utilities first
4. Built Acme handler, tested, fixed issues
5. Built Globex handler, tested, fixed issues
6. Refined human-like behavior throughout
7. Added resume generation feature with Gemini API integration
8. Implemented LaTeX compilation and PDF generation
9. Added API key rotation and model fallback logic

---

## Bonus Features Implemented

**Dynamic Resume Generation:**
- Generates company-specific ATS-friendly resumes using Gemini API
- LaTeX-based resume generation with professional formatting
- Automatic PDF compilation and cleanup
- Multiple API key support with automatic rotation
- Model fallback for free tier compatibility
- Detailed logging for debugging and monitoring

**Key Features:**
- Resume generated before each company submission
- Tailored content based on company name
- Uses exact LaTeX template format (1-page constraint)
- Automatic cleanup after submission
- Graceful fallback if generation fails

---

## Conclusion

The system successfully meets all requirements:
- Both forms automated end-to-end
- Clean, extensible architecture
- All human-like behaviors implemented
- Easy to add new platforms
- Well-structured, maintainable code
- Bonus: Dynamic resume generation with AI

The architecture demonstrates solid software engineering principles while remaining practical and working correctly. The addition of AI-powered resume generation adds significant value and demonstrates initiative beyond the basic requirements.
