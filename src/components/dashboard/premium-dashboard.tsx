import { Link } from "@tanstack/react-router";
import {
  Atom,
  BarChart3,
  BookOpen,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Dna,
  FileText,
  FlaskConical,
  GraduationCap,
  Layers3,
  MessageCircle,
  Sparkles,
  Target,
  Trophy,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

type SubjectCounts = {
  physics: number;
  chemistry: number;
  biology: number;
};

type Props = {
  firstName: string;
  streak: number;
  dailyGoal: number;
  todayQuestions: number;
  todayCorrect: number;
  todayWrong: number;
  todayAccuracy: number;
  progressPercent: number;
  subjectCounts: SubjectCounts;
  onEditTarget: () => void;
};

const card =
  "relative overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#101a1b]/90 shadow-[0_16px_40px_rgba(0,0,0,.20)] backdrop-blur-xl";

const pill =
  "rounded-full border border-white/[0.12] bg-white/[0.035] px-3 py-2 text-[11px] font-semibold text-[#e8e1d1] transition hover:bg-white/[0.07]";

function SectionTitle({
  icon: Icon,
  title,
  action,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: string;
  to?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-[#e8c77b]" />
        <h2 className="text-[15px] font-extrabold tracking-tight text-[#f4f0e7]">{title}</h2>
      </div>
      {action && to && (
        <Link to={to as never} className="flex items-center gap-1 text-[11px] font-bold text-[#e8c77b]">
          {action}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function FeatureRow({
  to,
  icon: Icon,
  title,
  subtitle,
  image,
  tone = "gold",
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  image?: string;
  tone?: "gold" | "blue" | "green" | "purple";
}) {
  const tones = {
    gold: "from-[#2a2519] via-[#171b1a] to-[#10191b] border-[#8d7139]/40",
    blue: "from-[#102338] via-[#101b24] to-[#10191b] border-[#477da8]/40",
    green: "from-[#112a24] via-[#111f1d] to-[#10191b] border-[#4b8b70]/35",
    purple: "from-[#21172a] via-[#17181f] to-[#10191b] border-[#805a9d]/40",
  }[tone];

  return (
    <Link
      to={to as never}
      className={`${card} group flex min-h-[92px] items-center gap-4 bg-gradient-to-r ${tones} p-4 transition duration-200 hover:-translate-y-0.5 hover:border-white/20`}
    >
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[46%] object-cover opacity-[0.20] mix-blend-screen"
        />
      )}
      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#0b1517]/80 text-[#e8c77b] shadow-inner">
        <Icon className="h-6 w-6" />
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <div className="text-[15px] font-extrabold text-[#f5f1e8]">{title}</div>
        <div className="mt-1 text-[11px] leading-4 text-[#b7b6ae]">{subtitle}</div>
      </div>
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[#d8d7ce]">
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function SubjectCard({
  to,
  title,
  count,
  percent,
  icon: Icon,
  tone,
}: {
  to: string;
  title: string;
  count: number;
  percent: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "blue" | "cream" | "green";
}) {
  const styles = {
    blue: {
      box: "from-[#172b40] to-[#111d26] border-[#4d789b]/40",
      icon: "text-[#b8d6ed]",
      bar: "bg-[#a7c9e6]",
    },
    cream: {
      box: "from-[#eee1c8] to-[#d7c5a4] border-[#f3e4c6]/60",
      icon: "text-[#263c3a]",
      bar: "bg-[#28463b]",
    },
    green: {
      box: "from-[#18372e] to-[#13251f] border-[#659b7f]/35",
      icon: "text-[#b9e2c4]",
      bar: "bg-[#9bd5aa]",
    },
  }[tone];

  const light = tone === "cream";

  return (
    <Link
      to={to as never}
      className={`group relative min-w-0 overflow-hidden rounded-[20px] border bg-gradient-to-br p-4 shadow-lg transition duration-200 hover:-translate-y-0.5 ${styles.box}`}
    >
      <div className="flex items-start justify-between">
        <Icon className={`h-8 w-8 ${styles.icon}`} strokeWidth={1.8} />
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${light ? "bg-black/10 text-[#253c38]" : "bg-white/10 text-white"}`}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-3 text-[15px] font-extrabold ${light ? "text-[#16211f]" : "text-white"}`}>{title}</div>
      <div className={`mt-0.5 text-[10px] ${light ? "text-[#40504b]" : "text-white/65"}`}>
        {count.toLocaleString()} Questions
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${light ? "bg-black/10" : "bg-white/10"}`}>
          <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${percent}%` }} />
        </div>
        <span className={`text-[10px] font-bold ${light ? "text-[#253c38]" : "text-white/80"}`}>{percent}%</span>
      </div>
    </Link>
  );
}

export function PremiumDashboard({
  firstName,
  streak,
  dailyGoal,
  todayQuestions,
  todayCorrect,
  todayWrong,
  todayAccuracy,
  progressPercent,
  subjectCounts,
  onEditTarget,
}: Props) {
  return (
    <div className="min-h-screen bg-[#071011] text-[#f4f0e7]">
      <div className="mx-auto w-full max-w-[520px] px-3 pb-28 pt-3 sm:max-w-3xl sm:px-5">
        <header className="mb-3 flex items-center justify-between rounded-[24px] border border-white/[0.08] bg-[#0c1517]/95 px-3 py-3 shadow-[0_14px_35px_rgba(0,0,0,.25)]">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="NEET Track" className="h-11 w-11 rounded-full border border-[#d9b866]/30 object-cover" />
            <div className="leading-none">
              <div className="text-[18px] font-black tracking-tight">
                NEET <span className="text-[#e8c77b]">Track</span>
              </div>
              <div className="mt-1 text-[8px] font-semibold tracking-[0.24em] text-[#9b9e99]">LEARN • PRACTICE • ACHIEVE</div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
            {[
              ["⌕", "Search"],
              ["☼", "Theme"],
              ["♧", "Notifications"],
              ["☰", "Menu"],
            ].map(([symbol, label]) => (
              <button
                key={label}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-lg text-[#d7d4cb]"
              >
                {symbol}
              </button>
            ))}
          </div>
        </header>

        <section className="relative mb-4 overflow-hidden rounded-[27px] border border-[#d9b866]/25 bg-gradient-to-br from-[#111c1d] via-[#16201f] to-[#0e1718] p-5 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
          <img src="/dashboard-study-scene.svg" alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[82%] w-[53%] object-contain opacity-80" />
          <div className="relative z-10 max-w-[68%]">
            <div className="text-[22px] font-black leading-tight tracking-tight text-[#f6f0e4]">
              Good morning, {firstName}! 👋
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[#c4c3bb]">“Discipline today = Doctor tomorrow.”<br />You're on track!</p>
          </div>

          <div className="relative z-10 mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8c77b]/35 bg-[#e8c77b]/10 text-[#e8c77b]">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[13px] font-extrabold">Daily Target</div>
                  <div className="text-[12px] font-bold text-[#91d7b0]">
                    {todayCorrect + todayWrong} / {dailyGoal} MCQs ({progressPercent}%)
                  </div>
                </div>
              </div>
              <button onClick={onEditTarget} className="rounded-full border border-[#e8c77b]/35 px-3 py-2 text-[10px] font-bold text-[#eadbb8]">
                Edit Target
              </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d9b866]" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-4 border-t border-white/10 pt-3">
              <Metric icon={<FileText />} label="Done" value={todayQuestions} />
              <Metric icon={<CheckCircle2 />} label="Correct" value={todayCorrect} tone="green" />
              <Metric icon={<XCircle />} label="Wrong" value={todayWrong} tone="red" />
              <Metric icon={<BarChart3 />} label="Accuracy" value={`${todayAccuracy}%`} tone="gold" />
            </div>
          </div>
        </section>

        <SectionTitle icon={Zap} title="Quick Practice" action="View All Subjects" to="/dpp" />
        <div className="mb-5 grid grid-cols-3 gap-2.5">
          <SubjectCard to="/subjects/$subject" title="Physics" count={subjectCounts.physics} percent={68} icon={Atom} tone="blue" />
          <SubjectCard to="/subjects/$subject" title="Chemistry" count={subjectCounts.chemistry} percent={72} icon={FlaskConical} tone="cream" />
          <SubjectCard to="/subjects/$subject" title="Biology" count={subjectCounts.biology} percent={65} icon={Dna} tone="green" />
        </div>

        <section className={`${card} mb-4 bg-gradient-to-br from-[#12221f] to-[#0e1819] p-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8c77b]/10 text-[#e8c77b]">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-[16px] font-extrabold">Your Improvement Zone</div>
              <div className="text-[11px] text-[#9fa7a1]">Analyse. Learn. Track. Improve Faster.</div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#9fa7a1]" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link to="/bookmarks" className={pill}><Bookmark className="mr-1.5 inline h-3.5 w-3.5 text-[#e8c77b]" />Saved Questions</Link>
            <Link to="/mistakes" className={pill}><FileText className="mr-1.5 inline h-3.5 w-3.5 text-[#65d39c]" />My Mistakes</Link>
            <Link to="/progress" className={pill}><BarChart3 className="mr-1.5 inline h-3.5 w-3.5 text-[#8cc7ee]" />Deep Analytics</Link>
          </div>
        </section>

        <FeatureRow to="/generate" icon={FileText} title="Generate Custom Test" subtitle="Create your own test with full control." image="/dashboard-test.svg" tone="gold" />
        <div className="h-3" />
        <FeatureRow to="/mocks" icon={Trophy} title="Mock Tests" subtitle="Experience real NEET exam with full syllabus tests." image="/dashboard-mock.svg" tone="gold" />
        <div className="h-3" />
        <FeatureRow to="/pyqs" icon={BookOpen} title="PYQs" subtitle="Previous Year Questions (NEET 2013 – 2025)" image="/dashboard-pyq.svg" tone="blue" />
        <div className="h-3" />
        <FeatureRow to="/flashcards" icon={Layers3} title="Study Tools" subtitle="All tools to boost your preparation." image="/dashboard-study-tools.svg" tone="green" />
        <div className="h-3" />
        <FeatureRow to="/community" icon={Users} title="Live & Community" subtitle="Ask, Discuss, Learn with fellow NEET aspirants." image="/dashboard-community.svg" tone="purple" />

        <nav className="fixed bottom-3 left-1/2 z-50 flex w-[calc(100%-24px)] max-w-[500px] -translate-x-1/2 items-center justify-between rounded-[24px] border border-white/10 bg-[#0b1416]/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-2xl">
          <BottomNav to="/dashboard" icon={GraduationCap} label="Home" active />
          <BottomNav to="/dpp" icon={ClipboardList} label="Quiz" />
          <BottomNav to="/generate" icon={FileText} label="Test" />
          <BottomNav to="/flashcards" icon={BookOpen} label="Study" />
          <BottomNav to="/ncert-highlights" icon={BookOpen} label="Books" />
          <BottomNav to="/progress" icon={BarChart3} label="Analyse" />
        </nav>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "blue" | "green" | "red" | "gold";
}) {
  const color = { blue: "#8cc7ee", green: "#63d59b", red: "#e87878", gold: "#e8c77b" }[tone];
  return (
    <div className="flex min-w-0 flex-col items-center justify-center border-r border-white/10 last:border-0">
      <div className="flex items-center gap-1 text-[9px] font-semibold" style={{ color }}>
        <span className="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 text-[17px] font-black text-white">{value}</div>
    </div>
  );
}

function BottomNav({
  to,
  icon: Icon,
  label,
  active = false,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[18px] px-1 py-2 text-[9px] font-semibold transition ${active ? "bg-[#e8c77b]/10 text-[#e8c77b]" : "text-[#8e9694] hover:text-[#e8e4da]"}`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}
