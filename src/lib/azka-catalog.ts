// Miss Azka's map of NEET Track: every feature she can open, with the words
// students use for it. Shared by the server (to route questions) and the chat UI.

export type AzkaFeatureId =
  | "dashboard" | "daily" | "dpp" | "pyqs" | "mocks" | "target700" | "megaquiz" | "generate" | "infinite"
  | "nuggets" | "shortnotes" | "highlights" | "flashcards" | "neetlab"
  | "todo" | "improve" | "mistakes" | "saved" | "analytics" | "studypath" | "predictor" | "consult" | "mentorship"
  | "contests" | "battles" | "leaderboard" | "referrals" | "premium" | "wallet" | "profile" | "progress";

export type AzkaFeature = {
  id: AzkaFeatureId;
  label: string;
  path: string;
  desc: string;
  emoji: string;
  tint: string;
  keywords: string[];
};

export const AZKA_FEATURES: AzkaFeature[] = [
  { id: "dashboard", label: "Home", path: "/dashboard", desc: "Your streak, to-do and today's plan", emoji: "🏠", tint: "#0EA5E9", keywords: ["home", "dashboard", "main page"] },
  { id: "daily", label: "Daily DPP", path: "/daily", desc: "Today's practice set — 10 minutes a day", emoji: "⚡", tint: "#06B6D4", keywords: ["daily", "dpp", "today practice", "daily practice"] },
  { id: "dpp", label: "Chapter-wise Practice", path: "/dpp", desc: "Practise any chapter of Physics, Chemistry or Biology", emoji: "📚", tint: "#10B981", keywords: ["chapter wise", "chapterwise", "subject dpp", "practice", "practise"] },
  { id: "pyqs", label: "Previous Year Questions", path: "/pyqs", desc: "Real NEET papers, year by year", emoji: "📜", tint: "#EC4899", keywords: ["pyq", "pyqs", "previous year", "past paper", "neet paper", "old paper"] },
  { id: "mocks", label: "Mock Tests", path: "/mocks", desc: "Full NEET-pattern mock tests", emoji: "⏱️", tint: "#F59E0B", keywords: ["mock", "mocks", "full test", "full syllabus test"] },
  { id: "target700", label: "Target 700 Batch", path: "/target-700", desc: "46 NEET-pattern tests to push you past 700", emoji: "🎯", tint: "#F59E0B", keywords: ["target 700", "700", "test series", "batch"] },
  { id: "megaquiz", label: "Daily Mega Quiz", path: "/mega-quiz", desc: "Live every night at 8:30 PM — win prizes", emoji: "🏆", tint: "#EAB308", keywords: ["mega quiz", "mega", "8:30", "live quiz", "prize quiz"] },
  { id: "generate", label: "Generate a Test", path: "/generate", desc: "Pick chapters, count and timer — build your own test", emoji: "🛠️", tint: "#6366F1", keywords: ["generate", "custom test", "create test", "build test", "cbt"] },
  { id: "infinite", label: "Infinite Run", path: "/infinite-run", desc: "Keep answering until you miss one", emoji: "♾️", tint: "#8B5CF6", keywords: ["infinite", "endless", "streak run"] },
  { id: "nuggets", label: "NCERT Nuggets", path: "/nuggets", desc: "Read key NCERT lines, then solve questions on them", emoji: "💎", tint: "#10B981", keywords: ["nugget", "nuggets", "ncert lines", "key lines"] },
  { id: "shortnotes", label: "Short Notes", path: "/short-notes", desc: "NCERT-based notes, chapter by chapter", emoji: "📝", tint: "#0EA5E9", keywords: ["short notes", "notes", "note", "revision notes", "summary"] },
  { id: "highlights", label: "NCERT Highlights", path: "/highlighted-ncert", desc: "Highlighted NCERT lines that NEET asks", emoji: "🖍️", tint: "#F97316", keywords: ["highlight", "highlighted", "ncert highlight", "ncert book"] },
  { id: "flashcards", label: "Flashcards", path: "/flashcards", desc: "Flip cards for quick active recall", emoji: "🃏", tint: "#8B5CF6", keywords: ["flashcard", "flashcards", "flash card", "cards", "recall"] },
  { id: "neetlab", label: "NEETLab 3D", path: "/neetlab", desc: "See concepts in interactive 3D", emoji: "⚛️", tint: "#0EA5E9", keywords: ["3d", "neetlab", "lab", "simulation", "model"] },
  { id: "todo", label: "To-Do & Targets", path: "/todo", desc: "Plan your day and track targets", emoji: "✅", tint: "#10B981", keywords: ["todo", "to-do", "to do", "target", "plan my day", "tasks"] },
  { id: "improve", label: "Improvement Zone", path: "/improve", desc: "Fix your mistakes, revisit saved questions, see weak areas", emoji: "🔁", tint: "#EF4444", keywords: ["improve", "improvement", "improvement zone", "weak", "weakness"] },
  { id: "mistakes", label: "My Mistakes", path: "/improve?tab=mistakes", desc: "Every question you got wrong, ready to re-attempt", emoji: "❌", tint: "#EF4444", keywords: ["mistake", "mistakes", "wrong questions", "galti", "incorrect"] },
  { id: "saved", label: "Saved Questions", path: "/improve?tab=saved", desc: "Questions you bookmarked", emoji: "🔖", tint: "#F59E0B", keywords: ["saved", "bookmark", "bookmarks", "bookmarked"] },
  { id: "analytics", label: "My Analytics", path: "/improve?tab=analytics", desc: "Accuracy and weak chapters at a glance", emoji: "📊", tint: "#6366F1", keywords: ["analytics", "analysis", "accuracy", "performance", "report"] },
  { id: "studypath", label: "Study Path", path: "/ai-path", desc: "What to study next, made for you", emoji: "🧭", tint: "#6366F1", keywords: ["study path", "what to study", "study plan", "path", "roadmap", "timetable"] },
  { id: "predictor", label: "Score Predictor", path: "/score-predictor", desc: "Where your NEET score stands today", emoji: "📈", tint: "#F97316", keywords: ["predict", "predictor", "score", "rank", "expected marks"] },
  { id: "consult", label: "Dr. Azka Consult", path: "/consult", desc: "Predicted score, 12-hour study plan and full report", emoji: "🩺", tint: "#14B8A6", keywords: ["consult", "consultation", "personal report", "dr azka"] },
  { id: "mentorship", label: "Mentorship", path: "/mentorship", desc: "Get a personal NEET mentor", emoji: "🎓", tint: "#14B8A6", keywords: ["mentor", "mentorship", "guidance", "guide"] },
  { id: "contests", label: "Contests", path: "/contests", desc: "Live contests with prize money", emoji: "🥇", tint: "#EAB308", keywords: ["contest", "contests", "competition"] },
  { id: "battles", label: "1v1 Battles", path: "/battlegrounds", desc: "Challenge a friend or a random student", emoji: "⚔️", tint: "#EF4444", keywords: ["battle", "1v1", "versus", "duel", "fight", "challenge friend"] },
  { id: "leaderboard", label: "Leaderboard", path: "/leaderboard", desc: "See where you rank this week", emoji: "👑", tint: "#EAB308", keywords: ["leaderboard", "ranking", "rank list", "top students"] },
  { id: "referrals", label: "Refer & Earn", path: "/referrals", desc: "Share your code and earn rewards", emoji: "🎁", tint: "#EC4899", keywords: ["refer", "referral", "invite", "earn"] },
  { id: "premium", label: "Premium", path: "/premium", desc: "Unlock every test, note and feature", emoji: "💎", tint: "#A855F7", keywords: ["premium", "subscribe", "subscription", "upgrade", "buy", "price", "plan"] },
  { id: "wallet", label: "Wallet", path: "/wallet", desc: "Prize money, deposits and withdrawals", emoji: "👛", tint: "#10B981", keywords: ["wallet", "withdraw", "money", "balance", "payment"] },
  { id: "profile", label: "My Profile", path: "/profile", desc: "Your details and settings", emoji: "👤", tint: "#64748B", keywords: ["profile", "account", "settings", "name change"] },
  { id: "progress", label: "Weekly Progress", path: "/progress", desc: "Your week in numbers", emoji: "🗓️", tint: "#0EA5E9", keywords: ["progress", "weekly", "week report"] },
];

export const AZKA_FEATURE_BY_ID = new Map(AZKA_FEATURES.map((f) => [f.id, f]));

/** A tappable result in Azka's reply. */
export type AzkaCard =
  | { kind: "link"; title: string; sub: string; href: string; emoji: string; tint: string }
  | {
      kind: "quiz";
      title: string;
      sub: string;
      chapterIds: string[];
      count: number;
      difficulty: "Easy" | "Medium" | "Hard" | "Mixed";
      pyqOnly: boolean;
    };

export type AzkaAnswer = { reply: string; cards: AzkaCard[]; suggestions: string[] };

/** Starter chips shown in an empty chat (and to new students). */
export const AZKA_STARTERS = [
  "Short notes of Cell: The Unit of Life",
  "Make a 10-question quiz on Thermodynamics",
  "Flashcards for Human Reproduction",
  "Where can I fix my mistakes?",
  "What should I study today?",
  "Show me PYQs",
];
