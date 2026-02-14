# Design Document - ATS Form Automation System

## Overview

This document explains the architecture and design decisions for the ATS form automation system. The system successfully automates job applications across multiple ATS platforms (Acme Corp and Globex Corporation) with a clean, extensible architecture.

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
│       └── field-fillers.ts      # Shared field-filling utilities
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

---

## Hardest Part

**The async typeahead in Globex** was the most challenging:
- Results arrive after network delay (300-800ms)
- Results are shuffled each time (not in DOM order)
- Need to wait for spinner, then results, then find matching item
- Required careful timing and waiting logic

**Solution:** Used `waitForFunction()` to wait for results to appear, then iterated through results to find match by text content.

---

## AI Tools Used

- **Cursor AI:** Used for code generation, refactoring, and debugging
- **Claude Code:** I used it t generate the outlie and overview of how will I implement the solution

**Workflow:**
1. Read HTML forms to understand structure
2. Designed architecture (Strategy + Registry pattern)
3. Implemented shared utilities first
4. Built Acme handler, tested, fixed issues
5. Built Globex handler, tested, fixed issues
6. Refined human-like behavior throughout

---

## Conclusion

The system successfully meets all requirements:
- Both forms automated end-to-end
- Clean, extensible architecture
- All human-like behaviors implemented
- Easy to add new platforms
- Well-structured, maintainable code

The architecture demonstrates solid software engineering principles while remaining practical and working correctly.
