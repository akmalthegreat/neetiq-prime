// Client-safe constants shared between server & client access layers.
export const TRIAL_FEATURES = [
  "daily_dpp",
  "ai_mock_tests",
  "unlimited_ai_quizzes",
  "pyqs",
  "bookmarks",
  "generate_test",
  "weekly_progress",
  "subject_wise_quiz",
] as const;

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
};
