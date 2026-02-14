/**
 * Candidate profile data used to fill job applications.
 */
export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn?: string;
  portfolio?: string;
  school: string;
  education: "high-school" | "associates" | "bachelors" | "masters" | "phd";
  experienceLevel: "0-1" | "1-3" | "3-5" | "5-10" | "10+";
  skills: string[];
  workAuthorized: boolean;
  requiresVisa: boolean;
  earliestStartDate: string; // YYYY-MM-DD
  salaryExpectation?: string;
  referralSource: string;
  coverLetter: string;
};

/**
 * Result of an application attempt.
 */
export type ApplicationResult = {
  success: boolean;
  confirmationId?: string;
  error?: string;
  screenshotPath?: string;
  durationMs: number;
};
