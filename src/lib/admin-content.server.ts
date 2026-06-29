import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminQuestionInput = {
  text: string;
  options: string[];
  correct_index: number;
  difficulty?: string;
  source?: string;
  marks_correct?: number;
  marks_wrong?: number;
  explanation?: string | null;
  subject?: string;
  chapter?: string;
  is_pyq?: boolean;
  pyq_year?: number | null;
};

export type ChapterQuizInput = {
  subject: string;
  chapter: string;
  title?: string;
  description?: string;
  duration_min?: number;
  difficulty?: string;
  source?: string;
  questions: AdminQuestionInput[];
};

export type ChapterImportInput = {
  subject: string;
  name: string;
  class?: number | null;
  order_index?: number;
};

const SUBJECT_NAMES: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  botany: "Botany",
  zoology: "Zoology",
  biology: "Biology",
};

function norm(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function displaySubject(value: string) {
  const key = norm(value);
  return SUBJECT_NAMES[key] ?? value.trim().replace(/\w\S*/g, (s) => s[0].toUpperCase() + s.slice(1).toLowerCase());
}

export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export async function logAdminAction(userId: string, action: string, target: string | null, meta: Record<string, unknown>) {
  await supabaseAdmin.from("admin_actions").insert({ user_id: userId, action, target, meta: meta as never });
}

export async function ensureSubject(name: string) {
  const clean = displaySubject(name);
  if (!clean) throw new Error("Subject is required");
  const { data: existing, error: findErr } = await supabaseAdmin
    .from("subjects")
    .select("id,name")
    .ilike("name", clean)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (existing?.id) return { id: existing.id, name: existing.name };

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .insert({ name: clean })
    .select("id,name")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? `Could not create subject ${clean}`);
  return { id: data.id, name: data.name };
}

export async function ensureChapter(subjectId: string, name: string, klass?: number | null, orderIndex = 0) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Chapter is required");
  const { data: chapters, error: findErr } = await supabaseAdmin
    .from("chapters")
    .select("id,name")
    .eq("subject_id", subjectId);
  if (findErr) throw new Error(findErr.message);
  const existing = (chapters ?? []).find((chapter) => norm(chapter.name) === norm(clean));
  if (existing?.id) return { id: existing.id, name: existing.name, created: false };

  const { data, error } = await supabaseAdmin
    .from("chapters")
    .insert({ subject_id: subjectId, name: clean, class: klass ?? null, order_index: orderIndex })
    .select("id,name")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? `Could not create chapter ${clean}`);
  return { id: data.id, name: data.name, created: true };
}

export function cleanQuestion(q: AdminQuestionInput, subjectId: string | null, chapterId: string | null) {
  const options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o ?? "").trim()).slice(0, 4);
  while (options.length < 4) options.push("");
  if (!q.text?.trim()) throw new Error("Question text is required");
  if (options.some((option) => !option)) throw new Error(`Question "${q.text.slice(0, 40)}..." has empty options`);
  const correctIndex = Number(q.correct_index ?? 0);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error("Correct option must be 0, 1, 2, or 3");
  return {
    subject_id: subjectId,
    chapter_id: chapterId,
    text: q.text.trim(),
    options,
    correct_index: correctIndex,
    explanation: q.explanation ? String(q.explanation) : null,
    difficulty: String(q.difficulty ?? "medium").toLowerCase(),
    source: String(q.source ?? "NCERT"),
    marks_correct: Number(q.marks_correct ?? 4),
    marks_wrong: Number(q.marks_wrong ?? -1),
    is_pyq: Boolean(q.is_pyq || q.pyq_year != null || String(q.source ?? "").toUpperCase().includes("PYQ")),
    pyq_year: q.pyq_year == null ? null : Number(q.pyq_year),
  };
}

export async function insertQuestions(rows: ReturnType<typeof cleanQuestion>[]) {
  const ids: string[] = [];
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { data, error } = await supabaseAdmin.from("questions").insert(chunk).select("id");
    if (error) {
      errors.push(error.message);
      for (const row of chunk) {
        const single = await supabaseAdmin.from("questions").insert(row).select("id").maybeSingle();
        if (single.data?.id) ids.push(single.data.id);
        else if (single.error) errors.push(single.error.message);
      }
    } else {
      ids.push(...((data ?? []) as Array<{ id: string }>).map((row) => row.id));
    }
  }
  return { ids, errors: Array.from(new Set(errors)) };
}