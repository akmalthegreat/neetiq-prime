// Client-safe constants shared between server & client access layers.
//
// Access model
//  • First 21 days after sign-up (the free period): every study feature is open.
//  • After that, without Premium: everything stays open EXCEPT the PREMIUM_ONLY features.
//  • Premium (an active subscription) or admin: everything.
// Paid human services (mentor program, priority support) are never part of the free period.

export const FREE_PERIOD_DAYS = 21;

/** Locked after the free period unless the student has Premium. */
export const PREMIUM_ONLY = ["generate_test", "improvement_zone", "ai_mock_tests", "neetlab"] as const;

/** Paid services that only come with a purchased plan. */
export const PAID_SERVICES = ["dedicated_program", "priority_support"] as const;

/** Every study feature key used by the app. */
export const ALL_STUDY_FEATURES = [
  "daily_dpp", "ai_mock_tests", "unlimited_ai_quizzes", "flashcards", "ncert_highlights", "pyqs", "contests",
  "battlegrounds", "infinite_run", "analytics", "score_predictor", "neetlab", "bookmarks", "ai_path",
  "generate_test", "improvement_zone", "weekly_progress", "subject_wise_quiz",
] as const;

/** During the free period: all study features. */
export const TRIAL_FEATURES = [...ALL_STUDY_FEATURES];

/** After the free period, without Premium. */
export const FREE_FEATURES = ALL_STUDY_FEATURES.filter((f) => !(PREMIUM_ONLY as readonly string[]).includes(f));

export const FEATURE_LABELS_UI: Record<string, string> = {
  daily_dpp: "DPP HUB",
  ai_mock_tests: "AI Mock Tests",
  unlimited_ai_quizzes: "AI Quizzes",
  flashcards: "Flashcards",
  ncert_highlights: "NCERT Highlights",
  pyqs: "NEET PYQs",
  contests: "Contests",
  battlegrounds: "Battlegrounds",
  analytics: "Advanced analytics",
  score_predictor: "AI Score Predictor",
  neetlab: "NEETLab",
  bookmarks: "Bookmarks",
  priority_support: "Priority support",
  ai_path: "AI Study Path",
  dedicated_program: "Dedicated mentor program",
  generate_test: "Custom Test",
  weekly_progress: "Weekly progress",
  subject_wise_quiz: "Subject-wise quiz",
  improvement_zone: "Improvement Zone",
  infinite_run: "Infinite Run",
};
