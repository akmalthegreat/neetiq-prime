import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  CheckCircle2,
  CalendarDays,
  Flame,
  BarChart2,
  TrendingUp,
  Clock,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Target,
  Trophy,
  Filter,
  CheckCheck,
  BookOpen,
  Atom,
  FlaskConical,
  Dna,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/todo")({
  component: TodoListPage,
});

export type TodoItem = {
  id: string;
  title: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Mock" | "Revision" | "General";
  timeMinutes: number;
  priority: "high" | "medium" | "low";
  completed: boolean;
  createdAt: string;
};

const SUBJECT_CONFIG = {
  Physics: {
    color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40",
    icon: Atom,
  },
  Chemistry: {
    color: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/40",
    icon: FlaskConical,
  },
  Biology: {
    color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40",
    icon: Dna,
  },
  Mock: {
    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40",
    icon: Trophy,
  },
  Revision: {
    color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40",
    icon: BookOpen,
  },
  General: {
    color: "text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800",
    icon: Target,
  },
};

const DEFAULT_TODOS: TodoItem[] = [];

export function TodoListPage() {
  const { user } = useAuth();
  const dateKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const storageKey = `neetiq_todos_${user?.id || "guest"}_${dateKey}`;

  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<TodoItem["subject"]>("Biology");
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [showRecap, setShowRecap] = useState(false);
  const [priority, setPriority] = useState<TodoItem["priority"]>("high");
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(todos));
    } catch {
      // ignore
    }
  }, [todos, storageKey]);

  const totalTasks = todos.length;
  const completedTasks = todos.filter((t) => t.completed).length;
  const totalMinutes = todos.reduce((acc, t) => acc + (t.timeMinutes || 0), 0);
  const completedMinutes = todos
    .filter((t) => t.completed)
    .reduce((acc, t) => acc + (t.timeMinutes || 0), 0);
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    const newItem: TodoItem = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      subject,
      timeMinutes: Number(timeMinutes) || 30,
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTodos((prev) => [newItem, ...prev]);
    setTitle("");
    toast.success("Task & Time Ticket added!");
  };

  const handleToggle = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const next = !t.completed;
          if (next) toast.success(`Completed: ${t.title}`);
          return { ...t, completed: next };
        }
        return t;
      })
    );
  };

  const handleDelete = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    toast.info("Task removed");
  };

  const handleSubmitDailyList = () => {
    setSubmitted(true);
    toast.success("🎉 Today's Study Ticket submitted! Keep pushing forward!");
  };

  const filteredTodos = todos.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  return (
    <PageShell>
      <div className="relative -mx-4 -my-10 px-4 py-8 sm:-mx-6 sm:-my-14 sm:px-6 sm:py-10 lg:-mx-8 lg:px-8 bg-gradient-to-b from-sky-50/70 via-teal-50/40 to-emerald-50/60 dark:from-[#0b1a27] dark:via-[#0e2334] dark:to-[#081520] min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-3xl space-y-5 pb-12">
          {/* Back button and navigation */}
          <div className="flex items-center justify-between">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Link>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5 text-teal-500" />
              <span>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Hero Header Card */}
          <div className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-white via-white/95 to-teal-50/70 p-5 shadow-lg shadow-teal-500/5 dark:border-teal-500/30 dark:bg-gradient-to-br dark:from-[#0f3239] dark:via-[#133d45] dark:to-[#0c282e] dark:text-white">
            <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-400/20" />
            <div className="pointer-events-none absolute -bottom-10 left-10 h-40 w-40 rounded-full bg-cyan-400/15 blur-2xl dark:bg-cyan-400/20" />

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/20 dark:text-teal-300">
                    <Sparkles className="h-3 w-3" />
                    <span>Daily Study Plan &amp; Time Tickets</span>
                  </div>
                  <h1 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Today's High-Yield Checklist
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-teal-100/80">
                    Set targeted time tickets, focus on your weak topics, and check off every milestone.
                  </p>
                </div>

                <div className="flex sm:flex-col items-center justify-between sm:items-end gap-1.5 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-xs dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                    <CheckCheck className="h-4 w-4" />
                    <span>{completedTasks} of {totalTasks} Done</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-300">
                    <Clock className="h-3 w-3 text-cyan-500" />
                    <span>{completedMinutes}m / {totalMinutes}m ticket</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-200">Completion Progress</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{progressPercent}%</span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-500 shadow-sm shadow-emerald-500/30"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>


          {/* =========================================================
              WEEKLY TRACK REPORT SECTION
              ========================================================= */}
          <div className="overflow-hidden rounded-3xl border border-teal-200/80 bg-white/95 p-5 shadow-md shadow-teal-900/5 dark:border-teal-500/20 dark:bg-slate-900/70 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20">
                  <BarChart2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Weekly Track Report
                    </h2>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      7-Day Momentum
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live overview of planned study hours, ticket completion, and subject distribution
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRecap(true)}
                className="self-start sm:self-auto rounded-xl border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-500/30 dark:text-teal-300 dark:hover:bg-teal-950/40 text-xs font-bold"
              >
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                <span>Full Recap Details</span>
              </Button>
            </div>

            {/* Metrics cards */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-center dark:border-white/5 dark:bg-white/5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Planned Time
                </span>
                <span className="mt-1 block text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {(totalMinutes / 60).toFixed(1)} <span className="text-xs font-semibold text-slate-500">hrs</span>
                </span>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center dark:border-emerald-500/20 dark:bg-emerald-950/20">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Completed Time
                </span>
                <span className="mt-1 block text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {(completedMinutes / 60).toFixed(1)} <span className="text-xs font-semibold">hrs</span>
                </span>
              </div>
              <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-3 text-center dark:border-teal-500/20 dark:bg-teal-950/20">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Tickets Done
                </span>
                <span className="mt-1 block text-base sm:text-lg font-black text-teal-600 dark:text-teal-400">
                  {completedTasks} <span className="text-xs font-semibold text-slate-500">/ {totalTasks}</span>
                </span>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center dark:border-amber-500/20 dark:bg-amber-950/20">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Completion
                </span>
                <span className="mt-1 block text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                  {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Subject Distribution Bar */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">Subject Distribution</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {todos.length} active tickets
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { name: "Biology", color: "bg-purple-500", text: "text-purple-600 dark:text-purple-400", count: todos.filter((t) => t.subject === "Biology").length },
                  { name: "Chemistry", color: "bg-teal-500", text: "text-teal-600 dark:text-teal-400", count: todos.filter((t) => t.subject === "Chemistry").length },
                  { name: "Physics", color: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", count: todos.filter((t) => t.subject === "Physics").length },
                  { name: "Mocks/Rev", color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", count: todos.filter((t) => t.subject === "Mock" || t.subject === "Revision").length },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 dark:bg-white/5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} />
                      <span className={`text-[11px] font-semibold truncate ${s.text}`}>{s.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white ml-1">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Add Task Form Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 sm:p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-white backdrop-blur-xs">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Plus className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>Create New Study Ticket</span>
            </h2>

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Complete 50 questions in Human Reproduction & analyze mistakes..."
                  className="rounded-xl border-slate-200 bg-white dark:border-white/15 dark:bg-white/5 h-10 text-xs sm:text-sm font-medium focus-visible:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Subject Selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as TodoItem["subject"])}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="Biology" className="bg-slate-900 text-white">Biology</option>
                    <option value="Chemistry" className="bg-slate-900 text-white">Chemistry</option>
                    <option value="Physics" className="bg-slate-900 text-white">Physics</option>
                    <option value="Mock" className="bg-slate-900 text-white">Mock Test</option>
                    <option value="Revision" className="bg-slate-900 text-white">Revision</option>
                    <option value="General" className="bg-slate-900 text-white">General / Doubt</option>
                  </select>
                </div>

                {/* Time Ticket Duration */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                    Time Ticket (Mins)
                  </label>
                  <select
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value={20} className="bg-slate-900 text-white">20 Mins (Sprint)</option>
                    <option value={30} className="bg-slate-900 text-white">30 Mins (Quick)</option>
                    <option value={45} className="bg-slate-900 text-white">45 Mins (Standard)</option>
                    <option value={60} className="bg-slate-900 text-white">60 Mins (1 Hour)</option>
                    <option value={90} className="bg-slate-900 text-white">90 Mins (1.5 Hours)</option>
                    <option value={120} className="bg-slate-900 text-white">120 Mins (2 Hours)</option>
                    <option value={150} className="bg-slate-900 text-white">150 Mins (2.5 Hours)</option>
                    <option value={180} className="bg-slate-900 text-white">180 Mins (3 Hours)</option>
                    <option value={210} className="bg-slate-900 text-white">210 Mins (3.5 Hours)</option>
                    <option value={240} className="bg-slate-900 text-white">240 Mins (4 Hours Max Power Block)</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TodoItem["priority"])}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="high" className="bg-slate-900 text-white">🔥 High Priority</option>
                    <option value="medium" className="bg-slate-900 text-white">⚡ Medium</option>
                    <option value="low" className="bg-slate-900 text-white">🌱 Low</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <Button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold shadow-md shadow-teal-500/20 text-xs px-4 py-2 h-9"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  <span>Add To-Do Ticket</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Filter Bar & List Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Study Items ({filteredTodos.length})
              </h3>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 p-0.5 text-xs dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  filter === "all"
                    ? "bg-teal-500 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("pending")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  filter === "pending"
                    ? "bg-teal-500 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setFilter("completed")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  filter === "completed"
                    ? "bg-teal-500 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-2.5">
            {filteredTodos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  No tasks found in this view. Add one above to kickstart your study session!
                </p>
              </div>
            ) : (
              filteredTodos.map((item) => {
                const subConfig = SUBJECT_CONFIG[item.subject] || SUBJECT_CONFIG.General;
                const IconComponent = subConfig.icon;

                return (
                  <div
                    key={item.id}
                    className={`group relative flex items-center justify-between rounded-2xl border p-3.5 transition-all duration-200 ${
                      item.completed
                        ? "border-emerald-200/60 bg-white/50 dark:border-emerald-900/30 dark:bg-emerald-950/10 opacity-75"
                        : "border-slate-200/80 bg-white hover:border-teal-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-teal-400/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(item.id)}
                        className="shrink-0 transition-transform active:scale-90"
                        aria-label={item.completed ? "Mark pending" : "Mark completed"}
                      >
                        {item.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-400 group-hover:text-teal-500" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${subConfig.color}`}
                          >
                            <IconComponent className="h-3 w-3" />
                            <span>{item.subject}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            <Clock className="h-2.5 w-2.5 text-cyan-500" />
                            <span>{item.timeMinutes}m ticket</span>
                          </span>

                          {item.priority === "high" && (
                            <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400">
                              High Yield
                            </span>
                          )}
                        </div>

                        <p
                          className={`mt-1 text-xs sm:text-sm font-semibold truncate ${
                            item.completed
                              ? "line-through text-slate-400 dark:text-slate-500"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {item.title}
                        </p>
                      </div>
                    </div>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="ml-2 text-slate-400 opacity-60 hover:opacity-100 hover:text-rose-500 transition-colors p-1"
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Submit / Finish Action */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-center dark:border-white/10 dark:bg-white/5">
            {submitted ? (
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-4 w-4" />
                <span>Today's Study Plan is active! Check off items as you study.</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Ready to lock in today's study goal?
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Submit your tickets and turn on your focus mode.
                  </div>
                </div>

                <Button
                  onClick={handleSubmitDailyList}
                  className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-teal-500/20"
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  <span>Submit Today's To-Do List</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Recap Modal */}
      <Dialog open={showRecap} onOpenChange={setShowRecap}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950">
          <DialogHeader>
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
              <CalendarDays className="h-5 w-5" />
              <DialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Weekly Study Recap
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Your 7-day NEET preparation momentum & focus breakdown
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Top Stat Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Total Planned</span>
                <span className="mt-1 block text-lg font-black text-slate-900 dark:text-white">
                  {(totalMinutes / 60).toFixed(1)} <span className="text-xs font-semibold">hrs</span>
                </span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Completed</span>
                <span className="mt-1 block text-lg font-black text-slate-900 dark:text-white">
                  {(completedMinutes / 60).toFixed(1)} <span className="text-xs font-semibold">hrs</span>
                </span>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Completion</span>
                <span className="mt-1 block text-lg font-black text-slate-900 dark:text-white">
                  {totalMinutes > 0 ? Math.round((completedMinutes / totalMinutes) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Subject Distribution */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2.5">
                Targeted Subject Focus
              </span>
              <div className="space-y-2">
                {[
                  { name: "Biology", color: "bg-emerald-500", count: todos.filter(t => t.subject === "Biology").length },
                  { name: "Chemistry", color: "bg-teal-500", count: todos.filter(t => t.subject === "Chemistry").length },
                  { name: "Physics", color: "bg-sky-500", count: todos.filter(t => t.subject === "Physics").length },
                  { name: "Mocks & Revision", color: "bg-purple-500", count: todos.filter(t => t.subject === "Mock" || t.subject === "Revision").length },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{s.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {s.count} {s.count === 1 ? "ticket" : "tickets"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivation Badge */}
            <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
              <Flame className="h-6 w-6 shrink-0 text-amber-500" />
              <div className="text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-300">Aiming for NEET 2027 Top Rank!</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Consistency in completing 3–4 hr focus sessions guarantees 700+ score.</p>
              </div>
            </div>

            <Button
              onClick={() => setShowRecap(false)}
              className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 font-bold text-white shadow-md shadow-teal-500/20"
            >
              Keep Crushing Goals
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>

  );
}
