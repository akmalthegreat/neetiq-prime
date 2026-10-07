// Daily to-do: shared types, helpers and content.

export type Subject = "physics" | "chemistry" | "biology" | "other";

export type StudyTask = {
  id: string;
  day: string;
  subject: Subject;
  title: string;
  target_min: number | null;
  spent_sec: number;
  timer_started_at: string | null;
  done: boolean;
  done_at: string | null;
  sort: number;
  created_at: string;
};

export type StudyDay = {
  day: string;
  locked_at: string | null;
  closed_at: string | null;
  mood: number | null;
  went_well: string | null;
  mistakes: string | null;
  mistake_tags: string[];
};

export const SUBJECTS: { key: Subject; label: string; color: string; soft: string; emoji: string }[] = [
  { key: "physics", label: "Physics", color: "#0EA5E9", soft: "rgba(14,165,233,.12)", emoji: "⚛️" },
  { key: "chemistry", label: "Chemistry", color: "#8B5CF6", soft: "rgba(139,92,246,.12)", emoji: "🧪" },
  { key: "biology", label: "Biology", color: "#10B981", soft: "rgba(16,185,129,.12)", emoji: "🧬" },
  { key: "other", label: "Extra", color: "#F59E0B", soft: "rgba(245,158,11,.12)", emoji: "✨" },
];
export const subjectOf = (k: string) => SUBJECTS.find((s) => s.key === k) ?? SUBJECTS[3];

export const MISTAKE_TAGS = [
  "Silly mistakes", "Concept not clear", "Didn't revise", "Wasted time on phone", "Started late",
  "Too many breaks", "Slept late", "Skipped tough questions", "Didn't read NCERT", "Got distracted",
];

export const MOODS = [
  { v: 1, emoji: "😞", label: "Tough day" },
  { v: 2, emoji: "😕", label: "Below par" },
  { v: 3, emoji: "🙂", label: "Okay" },
  { v: 4, emoji: "😊", label: "Good" },
  { v: 5, emoji: "🔥", label: "Excellent" },
];

/** The student's local calendar date as YYYY-MM-DD. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

/** Seconds studied on a task, including a timer that is still running. */
export function taskSeconds(t: Pick<StudyTask, "spent_sec" | "timer_started_at">, now = Date.now()): number {
  const live = t.timer_started_at ? Math.max(0, Math.floor((now - new Date(t.timer_started_at).getTime()) / 1000)) : 0;
  return t.spent_sec + Math.min(live, 12 * 3600);
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
export function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Well-sourced quotes from scientists, doctors, leaders and thinkers. */
export const QUOTES: { q: string; a: string }[] = [
  { q: "Arise, awake, and stop not till the goal is reached.", a: "Swami Vivekananda" },
  { q: "You have to dream before your dreams can come true.", a: "A. P. J. Abdul Kalam" },
  { q: "If you want to shine like a sun, first burn like a sun.", a: "A. P. J. Abdul Kalam" },
  { q: "Excellence is a continuous process and not an accident.", a: "A. P. J. Abdul Kalam" },
  { q: "You cannot change your future, but you can change your habits, and surely your habits will change your future.", a: "A. P. J. Abdul Kalam" },
  { q: "Man needs his difficulties because they are necessary to enjoy success.", a: "A. P. J. Abdul Kalam" },
  { q: "Take up one idea. Make that one idea your life; think of it, dream of it, live on that idea.", a: "Swami Vivekananda" },
  { q: "Strength does not come from physical capacity. It comes from an indomitable will.", a: "Mahatma Gandhi" },
  { q: "Education is the most powerful weapon which you can use to change the world.", a: "Nelson Mandela" },
  { q: "Nothing in life is to be feared, it is only to be understood.", a: "Marie Curie" },
  { q: "Life is not easy for any of us. But what of that? We must have perseverance and above all confidence in ourselves.", a: "Marie Curie" },
  { q: "Genius is one per cent inspiration, ninety-nine per cent perspiration.", a: "Thomas Edison" },
  { q: "Well done is better than well said.", a: "Benjamin Franklin" },
  { q: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", a: "Will Durant" },
  { q: "Success is the sum of small efforts, repeated day in and day out.", a: "Robert Collier" },
  { q: "Don't watch the clock; do what it does. Keep going.", a: "Sam Levenson" },
  { q: "Discipline is the bridge between goals and accomplishment.", a: "Jim Rohn" },
  { q: "A journey of a thousand miles begins with a single step.", a: "Lao Tzu" },
  { q: "You have a right to your actions, but never to the fruits of your actions.", a: "Bhagavad Gita 2.47" },
  { q: "Hard work beats talent when talent doesn't work hard.", a: "Tim Notke" },
  { q: "I fear not the man who has practised 10,000 kicks once, but I fear the man who has practised one kick 10,000 times.", a: "Bruce Lee" },
  { q: "The roots of education are bitter, but the fruit is sweet.", a: "Aristotle" },
  { q: "Patience, persistence and perspiration make an unbeatable combination for success.", a: "Napoleon Hill" },
  { q: "Determine never to be idle. No person will have occasion to complain of the want of time who never loses any.", a: "Thomas Jefferson" },
  { q: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", a: "Alexander Graham Bell" },
  { q: "Before anything else, preparation is the key to success.", a: "Alexander Graham Bell" },
  { q: "Wherever the art of medicine is loved, there is also a love of humanity.", a: "Hippocrates" },
  { q: "The good physician treats the disease; the great physician treats the patient who has the disease.", a: "William Osler" },
  { q: "Small daily improvements over time lead to stunning results.", a: "Robin Sharma" },
  { q: "You don't have to be great to start, but you have to start to be great.", a: "Zig Ziglar" },
  { q: "The difference between ordinary and extraordinary is that little extra.", a: "Jimmy Johnson" },
  { q: "Energy and persistence conquer all things.", a: "Benjamin Franklin" },
  { q: "The secret of success is constancy to purpose.", a: "Benjamin Disraeli" },
  { q: "It is not enough to have a good mind; the main thing is to use it well.", a: "René Descartes" },
];

/** Morning quote (4 AM–4 PM) and evening quote change every day. */
export function quoteNow(d = new Date()): { q: string; a: string; slot: "Morning" | "Evening" } {
  const h = d.getHours();
  const evening = h >= 16 || h < 4;
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (h < 4 ? 1 : 0));
  const dayNum = Math.floor(base.getTime() / 86_400_000);
  const i = (dayNum * 2 + (evening ? 1 : 0)) % QUOTES.length;
  return { ...QUOTES[(i + QUOTES.length) % QUOTES.length], slot: evening ? "Evening" : "Morning" };
}
