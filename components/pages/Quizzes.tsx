"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, FileUp, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import QuizBuilder from "@/components/QuizBuilder";
import { addXp } from "@/lib/api";
import { Question, Quiz } from "@/types";
import {
  Btn,
  Card,
  Empty,
  PageHeader,
  Pill,
  ProgressBar,
  Spinner,
} from "@/components/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useProfile } from "@/components/AppShell";

export default function Quizzes() {
  const { refreshProfile } = useProfile();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [availableReviewers, setAvailableReviewers] = useState<{ id: string; title: string }[]>([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");

  async function loadReviewers() {
    const { data } = await supabase.from("reviewers").select("id, title").order("title");
    setAvailableReviewers(data ?? []);
  }

  async function loadQuizzes() {
    const { data } = await supabase
      .from("quizzes")
      .select("*, questions(count), reviewers(title)")
      .eq("is_exam", false)
      .order("created_at");
    setQuizzes((data as Quiz[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadQuizzes();
    loadReviewers();
  }, []);

  // ── Create + build your own quiz ──
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [building, setBuilding] = useState<Quiz | null>(null);

  // ── PDF -> AI quiz ──
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const [generatingFromReviewer, setGeneratingFromReviewer] = useState(false);

  async function createQuiz() {
    if (!newTitle.trim()) return;
    const reviewerId = selectedReviewerId;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("quizzes")
      .insert({
        user_id: u.user!.id,
        title: newTitle.trim(),
        is_exam: false,
        reviewer_id: reviewerId || null,
      })
      .select()
      .single();
    if (error) {
      alert("Could not create quiz: " + error.message);
      return;
    }
    const quiz = data as Quiz;
    setNewTitle("");
    setSelectedReviewerId("");
    setShowNew(false);
    await loadQuizzes();

    if (reviewerId) {
      // Auto-generate questions from the linked reviewer's content instead
      // of making the user build the quiz manually.
      await generateQuestionsFromReviewer(quiz, reviewerId);
    } else {
      setBuilding(quiz); // go straight to adding questions manually
    }
  }

  async function generateQuestionsFromReviewer(quiz: Quiz, reviewerId: string) {
    setPdfError(null);
    setGeneratingFromReviewer(true);
    try {
      const { data: reviewer, error: revError } = await supabase
        .from("reviewers")
        .select("content")
        .eq("id", reviewerId)
        .single();
      if (revError || !reviewer?.content) {
        throw new Error("Could not load the linked reviewer's content.");
      }

      const formData = new FormData();
      formData.append("text", reviewer.content);

      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const { questions: generated } = (await res.json()) as {
        title: string;
        questions: {
          prompt: string;
          options: string[];
          correct_index: number;
          explanation: string | null;
          topic: string | null;
        }[];
      };
      if (!generated?.length) {
        throw new Error(
          "The AI could not generate questions from this reviewer.",
        );
      }

      const { error: qError } = await supabase.from("questions").insert(
        generated.map((q) => ({
          quiz_id: quiz.id,
          prompt: q.prompt,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          topic: q.topic,
        })),
      );
      if (qError) throw new Error(qError.message);

      await loadQuizzes();
      setBuilding(quiz); // open builder so they can review/edit the generated questions
    } catch (err: any) {
      setPdfError(
        err.message ??
          "Something went wrong generating the quiz from the linked reviewer.",
      );
    } finally {
      setGeneratingFromReviewer(false);
    }
  }

  function requestDeleteQuiz(quiz: Quiz) {
    setQuizToDelete(quiz);
  }

  async function confirmDeleteQuiz() {
    if (!quizToDelete) return;
    const quiz = quizToDelete;
    setQuizToDelete(null);

    const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
    if (error) {
      alert("Could not delete quiz: " + error.message);
      return;
    }
    setQuizzes((qs) => qs.filter((q) => q.id !== quiz.id));
  }

  // Upload a PDF, ask the AI to turn it into a quiz, then create quiz + bulk-insert questions
  async function handlePdfUpload(file: File) {
    if (file.type !== "application/pdf") {
      setPdfError("Please choose a PDF file.");
      return;
    }

    setUploadingPdf(true);
    setPdfError(null);
    setPdfProgress("Reading PDF…");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setPdfProgress("Asking AI to generate quiz questions…");
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const { title, questions: generated } = (await res.json()) as {
        title: string;
        questions: {
          prompt: string;
          options: string[];
          correct_index: number;
          explanation: string | null;
          topic: string | null;
        }[];
      };

      if (!generated?.length) {
        throw new Error(
          "The AI could not find enough content to make a quiz from this PDF.",
        );
      }

      setPdfProgress("Creating quiz…");
      const { data: u } = await supabase.auth.getUser();
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          user_id: u.user!.id,
          title,
          is_exam: false,
          reviewer_id: selectedReviewerId || null,
        })
        .select()
        .single();
      if (quizError) throw new Error(quizError.message);

      setPdfProgress(`Saving ${generated.length} questions…`);
      const { error: qError } = await supabase.from("questions").insert(
        generated.map((q) => ({
          quiz_id: quiz.id,
          prompt: q.prompt,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          topic: q.topic,
        })),
      );
      if (qError) throw new Error(qError.message);

      await loadQuizzes();
      setBuilding(quiz as Quiz); // open builder so they can review/edit the generated questions
    } catch (err: any) {
      setPdfError(
        err.message ?? "Something went wrong generating a quiz from that PDF.",
      );
    } finally {
      setUploadingPdf(false);
      setPdfProgress(null);
    }
  }

  async function start(quiz: Quiz) {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", quiz.id);
    setQuestions((data as Question[]) ?? []);
    setActive(quiz);
    setIndex(0);
    setAnswers({});
    setPicked(null);
    setFinished(false);
    setStartedAt(Date.now());
  }

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    setAnswers((a) => ({ ...a, [index]: i }));
  }

  async function next() {
    if (picked === null) return;
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setPicked(null);
    } else {
      const score = questions.reduce(
        (s, q, i) =>
          s +
          (answers[i] === q.correct_index ||
          (i === index && picked === q.correct_index)
            ? 1
            : 0),
        0,
      );
      const duration = Math.round((Date.now() - startedAt) / 1000);
      await supabase.from("quiz_attempts").insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        quiz_id: active!.id,
        mode: "quiz",
        score,
        total: questions.length,
        duration_seconds: duration,
      });
      await addXp(score * 5, `Quiz: ${active!.title}`);
      refreshProfile();
      setFinished(true);
    }
  }

  if (loading) return <Spinner />;

  // ── Question builder ──
  if (building) {
    return (
      <QuizBuilder
        quizId={building.id}
        title={building.title}
        onBack={() => {
          setBuilding(null);
          loadQuizzes();
        }}
      />
    );
  }

  // ── Results ──
  if (active && finished) {
    const score = questions.reduce(
      (s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0),
      0,
    );
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="page-in max-w-md mx-auto text-center pt-14">
        <Card className="p-8">
          <div className="text-5xl mb-3">
            {pct >= 80 ? "🎯" : pct >= 60 ? "💪" : "📖"}
          </div>
          <h2 className="text-2xl font-semibold">{pct}%</h2>
          <p className="text-sm text-slate-500 mb-4">
            {score} of {questions.length} correct · +{score * 5} XP
          </p>
          <div className="flex gap-2 justify-center">
            <Btn variant="ghost" onClick={() => setActive(null)}>
              Back to quizzes
            </Btn>
            <Btn onClick={() => start(active)}>Retake</Btn>
          </div>
        </Card>
      </div>
    );
  }

  // ── Player ──
  if (active) {
    const q = questions[index];
    if (!q)
      return (
        <Empty
          icon="❓"
          title="This quiz has no questions"
          sub="Add questions manually or generate them from a PDF."
          action={<Btn onClick={() => setActive(null)}>Back</Btn>}
        />
      );
    return (
      <div className="page-in max-w-2xl mx-auto">
        <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
          <button
            onClick={() => setActive(null)}
            className="hover:text-slate-900"
          >
            ← Exit
          </button>
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <ProgressBar
            value={((index + 1) / questions.length) * 100}
            className="flex-1"
          />
        </div>
        <Card className="p-7">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1.5">
            {q.topic ?? "Question"}
          </div>
          <h2 className="text-lg font-semibold mb-5 leading-relaxed">
            {q.prompt}
          </h2>
          {q.options.map((opt, i) => {
            let cls = "border-slate-200 hover:bg-slate-50";
            if (picked !== null) {
              if (i === q.correct_index)
                cls = "border-green-500 bg-green-50 pop";
              else if (i === picked) cls = "border-red-500 bg-red-50 shake";
              else cls = "border-slate-200 opacity-60";
            }
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={picked !== null}
                className={`flex items-center gap-3 w-full text-left border-[1.5px] rounded-xl px-4 py-3.5 text-sm mb-2.5 transition ${cls}`}
              >
                <span className="w-6 h-6 rounded-md border border-slate-300 grid place-items-center text-xs font-semibold shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            );
          })}
          {picked !== null && q.explanation && (
            <div className="mt-4 bg-primary-50 border-l-[3px] border-primary rounded-[10px] px-4 py-3 text-sm page-in">
              💡 <b>Why:</b> {q.explanation}
            </div>
          )}
        </Card>
        <div className="flex justify-end mt-4">
          <Btn onClick={next} disabled={picked === null}>
            {index + 1 === questions.length ? "Finish ✓" : "Next →"}
          </Btn>
        </div>
      </div>
    );
  }

  // ── Library ──
  return (
    <div className="page-in">
      <PageHeader
        title="Quizzes"
        sub="Practice mode — instant feedback after every answer"
        action={
          <Btn onClick={() => setShowNew((v) => !v)}>
            <Plus size={16} /> New quiz
          </Btn>
        }
      />
      {generatingFromReviewer && (
        <Card className="p-4 mb-5 flex items-center gap-3 text-sm text-primary">
          <Loader2 size={16} className="animate-spin" />
          ✨ Generating quiz questions from linked reviewer…
        </Card>
      )}
      {pdfError && !generatingFromReviewer && (
        <Card className="p-4 mb-5 text-sm text-red-500">{pdfError}</Card>
      )}

      {showNew && (
        <Card className="p-4 mb-5 flex gap-3 items-center flex-wrap">
          <input
            className="h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm flex-1 min-w-48 outline-none focus:ring-2 focus:ring-primary transition"
            placeholder="Quiz title (e.g. Chemistry — Stoichiometry Drill)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createQuiz()}
          />
          <select
            className="h-10 px-3 rounded-[10px] border border-slate-200 text-sm"
            value={selectedReviewerId}
            onChange={(e) => setSelectedReviewerId(e.target.value)}
          >
            <option value="">No linked reviewer</option>
            {availableReviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <Btn onClick={createQuiz}>Create quiz</Btn>
        </Card>
      )}

      <Card className="p-5 mb-5">
        <h3 className="font-semibold mb-1">Generate a quiz from a PDF</h3>
        <p className="text-xs text-slate-500 mb-3">
          Upload your notes or a reviewer and the AI will turn them into a
          multiple-choice quiz automatically.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <label
            className={`inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-[10px] border border-dashed text-sm cursor-pointer transition
            ${uploadingPdf ? "border-slate-200 text-slate-400 cursor-not-allowed" : "border-primary/40 text-primary hover:bg-primary-50"}`}
          >
            {uploadingPdf ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FileUp size={15} />
            )}
            {uploadingPdf ? (pdfProgress ?? "Working…") : "Choose a PDF"}
            <input
              type="file"
              accept="application/pdf"
              disabled={uploadingPdf}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handlePdfUpload(file);
              }}
            />
          </label>
          <select
            className="h-10 px-3 rounded-[10px] border border-slate-200 text-sm"
            value={selectedReviewerId}
            onChange={(e) => setSelectedReviewerId(e.target.value)}
          >
            <option value="">No linked reviewer</option>
            {availableReviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
        {pdfError && <p className="text-xs text-red-500 mt-2">{pdfError}</p>}
      </Card>

      {quizzes.length === 0 ? (
        <Empty
          icon="❓"
          title="No quizzes yet"
          sub="Click New quiz to build your own, or generate one from a PDF above."
        />
      ) : (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
          {quizzes.map((qz) => (
            <Card key={qz.id} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary-50 grid place-items-center text-xl">
                  ❓
                </div>
                <Pill tone="indigo">Practice</Pill>
              </div>
              <h3 className="font-semibold">{qz.title}</h3>
              <p className="text-xs text-slate-500 mb-1">
                {qz.questions?.[0]?.count ?? 0} questions · ~
                {qz.duration_minutes} min
              </p>
              {qz.reviewers?.title && (
                <p className="text-[11px] text-primary mb-2 truncate">
                  📎 {qz.reviewers.title}
                </p>
              )}
              <div className="flex gap-2">
                <Btn
                  className="flex-1"
                  onClick={() => start(qz)}
                  disabled={(qz.questions?.[0]?.count ?? 0) === 0}
                >
                  Start →
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => setBuilding(qz)}
                  title="Add or edit questions"
                >
                  <Pencil size={15} />
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => requestDeleteQuiz(qz)}
                  title="Delete quiz"
                  className="text-slate-300 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog
        open={!!quizToDelete}
        onOpenChange={(open) => !open && setQuizToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{quizToDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all its questions and attempt history. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQuiz}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}