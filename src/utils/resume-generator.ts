import { GoogleGenerativeAI } from "@google/generative-ai";
import type { UserProfile } from "../types";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Resume generator using Gemini API to create ATS-friendly LaTeX resumes
 */

const LATEX_TEMPLATE = `%-------------------------
% Resume in LaTeX
%------------------------

\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[colorlinks=true, linkcolor=blue, urlcolor=blue, citecolor=blue]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{geometry}

\\geometry{left=0.5in, right=0.5in, top=0.5in, bottom=0.5in}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\setlength{\\footskip}{5pt}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-7pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape {NAME}} \\\\ \\vspace{2pt}
    \\small {LOCATION} $|$ {PHONE}
\\end{center}

%-----------CONTACT-----------
\\section{Contact}
  \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
      \\begin{tabular*}{0.85\\textwidth}{@{}l@{\\hspace{2cm}}l@{}}
        \\textbf{Email:} \\href{mailto:{EMAIL}}{{EMAIL}} & \\textbf{GitHub:} \\href{{PORTFOLIO}}{{PORTFOLIO_SHORT}} \\\\
        \\textbf{LinkedIn:} \\href{{LINKEDIN}}{{LINKEDIN_SHORT}} & \\textbf{Portfolio:} \\href{{PORTFOLIO}}{{PORTFOLIO_SHORT}}
      \\end{tabular*}
    }}
  \\end{itemize}

%-----------EDUCATION-----------
\\section{Education}
  {EDUCATION_SECTION}

%-----------EXPERIENCE-----------
\\section{Experience}
  {EXPERIENCE_SECTION}

%-----------SKILLS-----------
\\section{Skills}
 {SKILLS_SECTION}

%-------------------------------------------
\\end{document}`;

/**
 * Get all available Gemini API keys from environment
 */
function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  let i = 1;
  while (process.env[`GEMINI_API_${i}`]) {
    keys.push(process.env[`GEMINI_API_${i}`]!);
    i++;
  }
  
  // Debug: Log if no keys found
  if (keys.length === 0) {
    console.log("  ⚠ No API keys found in environment variables");
    console.log("  Debug: Checking environment variables...");
    const geminiKeys = Object.keys(process.env).filter(k => k.startsWith("GEMINI_API_"));
    if (geminiKeys.length > 0) {
      console.log(`  Found ${geminiKeys.length} GEMINI_API_* variable(s): ${geminiKeys.join(", ")}`);
      geminiKeys.forEach(key => {
        const value = process.env[key];
        console.log(`    ${key} = ${value ? `${value.substring(0, 10)}... (SET)` : "NOT SET"}`);
      });
    } else {
      console.log("  No GEMINI_API_* variables found in environment");
    }
  } else {
    console.log(`  ✓ Found ${keys.length} API key(s) in environment`);
  }
  
  return keys;
}

/**
 * Generate LaTeX resume using Gemini API with fallback for rate limits
 */
async function generateLaTeXWithGemini(
  profile: UserProfile,
  companyName: string
): Promise<string> {
  const apiKeys = getGeminiApiKeys();

  if (apiKeys.length === 0) {
    throw new Error("No GEMINI_API keys found in environment variables");
  }

  const prompt = `Generate an ATS-friendly LaTeX resume in EXACTLY the following format. The resume MUST be exactly 1 page only (not 2 pages). Use the exact LaTeX template structure provided below.

CANDIDATE PROFILE:
- Name: ${profile.firstName} ${profile.lastName}
- Email: ${profile.email}
- Phone: ${profile.phone}
- Location: ${profile.location}
- LinkedIn: ${profile.linkedIn || "Not provided"}
- Portfolio/GitHub: ${profile.portfolio || "Not provided"}
- Education: ${profile.education} from ${profile.school}
- Experience Level: ${profile.experienceLevel} years
- Skills: ${profile.skills.join(", ")}
- Work Authorized: ${profile.workAuthorized ? "Yes" : "No"}
- Cover Letter Summary: ${profile.coverLetter.substring(0, 300)}

COMPANY: ${companyName}

REQUIREMENTS:
1. Use the EXACT LaTeX template structure provided below
2. Resume MUST be exactly 1 page (adjust content to fit)
3. ATS-friendly format (simple, clean, keyword-rich)
4. Include: Contact, Education, Experience, Skills sections
5. Emphasize technical skills from the profile
6. Create realistic experience entries based on experience level
7. Use standard LaTeX formatting from template
8. Make it professional and tailored for ${companyName}

LATEX TEMPLATE STRUCTURE:
${LATEX_TEMPLATE}

Generate ONLY the complete LaTeX code (starting from \\documentclass), no explanations, no markdown, just pure LaTeX code. Ensure it fits on exactly 1 page.`;

  // Try each API key until one works
  console.log(`  Found ${apiKeys.length} API key(s) available`);
  
  // Model fallback: Try 2.5-pro first, then fallback to 1.5-pro if not available
  const modelsToTry = ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"];
  
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKeyNum = i + 1;
    console.log(`  Trying API key ${apiKeyNum}...`);
    
    // Try each model for this API key
    for (const modelName of modelsToTry) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        const model = genAI.getGenerativeModel({ model: modelName });

        console.log(`  Calling ${modelName} API with key ${apiKeyNum}...`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const latexCode = response.text();

        console.log(`  ✓ API key ${apiKeyNum} succeeded with ${modelName}! Generated LaTeX code (${latexCode.length} characters)`);

        // Clean up the response (remove markdown code blocks if present)
        let cleanedLatex = latexCode.trim();
        if (cleanedLatex.startsWith("```latex")) {
          cleanedLatex = cleanedLatex.replace(/^```latex\n?/, "").replace(/```\n?$/, "");
        }
        if (cleanedLatex.startsWith("```")) {
          cleanedLatex = cleanedLatex.replace(/^```\n?/, "").replace(/```\n?$/, "");
        }

        return cleanedLatex.trim();
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        
        // Check if it's a model availability error (limit: 0 means model not available)
        const isModelUnavailable = 
          errorMessage.includes("limit: 0") ||
          (errorMessage.includes("quota") && errorMessage.includes("limit: 0"));
        
        // If model is unavailable, try next model
        if (isModelUnavailable && modelsToTry.indexOf(modelName) < modelsToTry.length - 1) {
          console.log(`  ✗ ${modelName} not available on free tier (limit: 0), trying next model...`);
          continue; // Try next model
        }
        
        // Check if it's a rate limit or API key error
        const isRateLimit = 
          errorMessage.includes("rate limit") ||
          errorMessage.includes("429") ||
          errorMessage.includes("quota") ||
          errorMessage.includes("RESOURCE_EXHAUSTED");
        
        const isApiKeyError = 
          errorMessage.includes("403") ||
          errorMessage.includes("Forbidden") ||
          errorMessage.includes("API key") ||
          errorMessage.includes("leaked") ||
          errorMessage.includes("invalid");
        
        // If it's the last model and we have an error, break to try next API key
        if (modelsToTry.indexOf(modelName) === modelsToTry.length - 1) {
          if (isRateLimit || isApiKeyError) {
            const errorType = isRateLimit ? "Rate limit/quota exceeded" : "API key invalid/leaked/forbidden";
            console.log(`  ✗ API key ${apiKeyNum} failed with ${modelName}: ${errorType}`);
            console.log(`    Error details: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? "..." : ""}`);
            
            if (i === apiKeys.length - 1) {
              console.log(`  ✗ All ${apiKeys.length} API key(s) exhausted - no more keys to try`);
              throw new Error(`All API keys failed. Last error: ${errorMessage}`);
            }
            
            console.log(`  → Switching to API key ${apiKeyNum + 1}...`);
            break; // Break to try next API key
          }
          
          // For other errors on last model, break to try next API key
          console.log(`  ✗ API key ${apiKeyNum} failed with ${modelName}: ${errorMessage.substring(0, 150)}${errorMessage.length > 150 ? "..." : ""}`);
          if (i === apiKeys.length - 1) {
            console.log(`  ✗ All ${apiKeys.length} API key(s) exhausted`);
            throw error;
          }
          console.log(`  → Trying API key ${apiKeyNum + 1}...`);
          break; // Break to try next API key
        }
        
        // If not last model, continue to next model
        continue;
      }
    }
    
    // If we get here, all models failed for this API key, try next API key
    if (i < apiKeys.length - 1) {
      console.log(`  → All models failed for API key ${apiKeyNum}, trying next API key...`);
    }
  }
  
  throw new Error("Failed to generate LaTeX with all API keys and models");
}

/**
 * Check if pdflatex is available
 */
async function checkPdflatexAvailable(): Promise<boolean> {
  try {
    await execAsync("which pdflatex");
    return true;
  } catch {
    return false;
  }
}

/**
 * Compile LaTeX to PDF
 */
async function compileLaTeXToPDF(latexPath: string, outputDir: string): Promise<string> {
  const pdfPath = path.join(outputDir, "sample-resume.pdf");
  
  // Check if pdflatex is available
  const pdflatexAvailable = await checkPdflatexAvailable();
  if (!pdflatexAvailable) {
    throw new Error(
      "pdflatex is not installed. Please install a LaTeX distribution (e.g., TeX Live, MiKTeX) or use Docker."
    );
  }
  
  try {
    const baseName = path.basename(latexPath, ".tex");
    const generatedPdfPath = path.join(outputDir, `${baseName}.pdf`);
    
    // Try pdflatex (most common)
    console.log(`  Running pdflatex on ${baseName}.tex...`);
    try {
      await execAsync(
        `pdflatex -output-directory="${outputDir}" -interaction=nonstopmode "${latexPath}"`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large outputs
      );
    } catch (execError: any) {
      // pdflatex may exit with non-zero code even if PDF is generated (due to LaTeX errors)
      // This is normal with nonstopmode - it continues despite errors
      console.log(`  pdflatex completed (may have warnings/errors, checking for PDF...)`);
    }
    
    // Check if PDF was generated (even if there were LaTeX warnings/errors)
    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for file system to sync
    
    if (!fs.existsSync(generatedPdfPath)) {
      // Check log file for errors
      const logPath = path.join(outputDir, `${baseName}.log`);
      let errorDetails = "Unknown error";
      if (fs.existsSync(logPath)) {
        const logContent = fs.readFileSync(logPath, "utf-8");
        const errorLines = logContent.split("\n").filter(line => 
          line.includes("!") || line.includes("Error") || line.includes("Fatal")
        );
        if (errorLines.length > 0) {
          errorDetails = errorLines.slice(0, 3).join("; ");
        }
      }
      throw new Error(`PDF was not generated. LaTeX errors: ${errorDetails}`);
    }
    
    console.log(`  PDF generated: ${baseName}.pdf`);
    
    // Rename to sample-resume.pdf
    if (generatedPdfPath !== pdfPath) {
      // Remove old sample-resume.pdf if it exists
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      fs.renameSync(generatedPdfPath, pdfPath);
      console.log(`  Renamed to sample-resume.pdf`);
    }
    
    // Clean up auxiliary files
    const auxFiles = [".aux", ".log", ".out"];
    for (const ext of auxFiles) {
      const auxPath = path.join(outputDir, `${baseName}${ext}`);
      if (fs.existsSync(auxPath)) {
        fs.unlinkSync(auxPath);
      }
    }
    
    // Final check - verify PDF exists
    if (!fs.existsSync(pdfPath)) {
      // Last resort: if generatedPdfPath exists but rename failed, copy it
      if (fs.existsSync(generatedPdfPath)) {
        console.log(`  Warning: Rename failed, copying instead...`);
        fs.copyFileSync(generatedPdfPath, pdfPath);
      } else {
        throw new Error(`PDF rename failed. Expected: ${pdfPath}, Generated: ${generatedPdfPath}`);
      }
    }
    
    // Verify it's actually a PDF
    const stats = fs.statSync(pdfPath);
    if (stats.size === 0) {
      throw new Error("Generated PDF is empty");
    }
    
    console.log(`  ✓ PDF ready: ${pdfPath} (${Math.round(stats.size / 1024)}KB)`);
    return pdfPath;
  } catch (error) {
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const logPath = path.join(outputDir, `${path.basename(latexPath, ".tex")}.log`);
    
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, "utf-8");
      const fatalErrors = logContent.split("\n").filter(line => line.includes("!") && line.includes("Error"));
      if (fatalErrors.length > 0) {
        throw new Error(`LaTeX compilation failed: ${errorMessage}\nLaTeX errors: ${fatalErrors.slice(0, 2).join("; ")}`);
      }
    }
    
    throw new Error(`LaTeX compilation failed: ${errorMessage}`);
  }
}

/**
 * Generate resume PDF for a specific company
 */
export async function generateResume(
  profile: UserProfile,
  companyName: string
): Promise<string> {
  const fixturesDir = path.join(process.cwd(), "fixtures");
  
  // Ensure fixtures directory exists
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  console.log(`\n  Generating ATS-friendly resume for ${companyName}...`);

  try {
    // Generate LaTeX using Gemini
    const latexCode = await generateLaTeXWithGemini(profile, companyName);

    // Save LaTeX to temporary file
    const latexPath = path.join(fixturesDir, "resume.tex");
    fs.writeFileSync(latexPath, latexCode, "utf-8");

    // Compile LaTeX to PDF
    console.log(`  Compiling LaTeX to PDF...`);
    const pdfPath = await compileLaTeXToPDF(latexPath, fixturesDir);

    // Clean up LaTeX file
    if (fs.existsSync(latexPath)) {
      fs.unlinkSync(latexPath);
    }

    console.log(`  Resume generated successfully: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.error(`  Failed to generate resume: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Delete the generated resume
 */
export function deleteResume(): void {
  const pdfPath = path.join(process.cwd(), "fixtures", "sample-resume.pdf");
  if (fs.existsSync(pdfPath)) {
    fs.unlinkSync(pdfPath);
    console.log(`  Resume deleted: ${pdfPath}`);
  }
}
