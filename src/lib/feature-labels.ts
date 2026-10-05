// Shared feature-key → user-facing label map (client-safe; no server imports).
export const FEATURE_LABEL_MAP: Record<string, string> = {
  daily_dpp: "DPP HUB",
  ai_mock_tests: "AI Mock Tests",
  unlimited_ai_quizzes: "Unlimited AI quizzes",
  flashcards: "Flashcards",
  ncert_highlights: "NCERT Highlights",
  pyqs: "NEET PYQs",
  contests: "Contests",
  battlegrounds: "1v1 Battlegrounds",
  analytics: "Advanced analytics",
  score_predictor: "AI Score Predictor",
  neetlab: "NEETLab 3D simulations",
  bookmarks: "Unlimited bookmarks",
  priority_support: "Priority support",
  ai_path: "Personalized AI study path",
  dedicated_program: "Dedicated mentor program",
};
export const FEATURE_KEYS = Object.keys(FEATURE_LABEL_MAP);
