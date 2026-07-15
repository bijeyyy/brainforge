"use client";

import { supabase } from "@/lib/supabase";
import { useRef, useState } from "react";
import { RotateCcw, Send, Sparkles, Check, X, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui";
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

// ---------- Types matching the shapes the API can return ----------
interface QuizQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  topic: string;
}
interface QuizPayload {
  type: "quiz";
  title: string;
  duration_minutes: number;
  passing_percent: number;
  questions: QuizQuestion[];
}
interface FlashcardsPayload {
  type: "flashcards";
  title: string;
  cards: { front: string; back: string }[];
}
interface ReviewerPayload {
  type: "reviewer";
  title: string;
  content: string;
}
interface TextPayload {
  type: "text";
  text: string;
}
type Structured =
  | QuizPayload
  | FlashcardsPayload
  | ReviewerPayload
  | TextPayload;

interface Msg {
  role: "user" | "assistant";
  content?: string; // used for user messages (plain text)
  structured?: Structured; // used for assistant messages
}

const capabilities = [
  {
    icon: "📄",
    label: "Generate Reviewer",
    template:
      "Generate a structured reviewer outline for [your topic/subject].",
  },
  {
    icon: "❓",
    label: "Generate Quiz",
    template:
      "Create a 5-question multiple choice quiz on [your topic/subject], with answers and explanations.",
  },
  {
    icon: "🃏",
    label: "Generate Flashcards",
    template: "Create 8 flashcards (front/back) about [your topic/subject].",
  },
  {
    icon: "🧒",
    label: "Explain Like I'm 10",
    template: "Explain [your topic/subject] like I'm 10 years old.",
  },
];

// ---------- Tiny inline markdown renderer (bold, bullets, numbered lists, paragraphs) ----------
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 space-y-1 my-2">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 space-y-1 my-2">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const label = line.replace(/^#{1,3}\s+/, "");
      const cls =
        level === 1
          ? "text-base font-bold mt-3 mb-1.5"
          : level === 2
            ? "text-[15px] font-bold mt-3 mb-1"
            : "text-sm font-semibold mt-2 mb-1";
      blocks.push(
        <div key={key++} className={cls}>
          {renderInline(label)}
        </div>,
      );
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1.5 leading-relaxed">
        {renderInline(paraLines.join(" "))}
      </p>,
    );
  }

  return <>{blocks}</>;
}

// ---------- Reviewer ----------
function ReviewerView({ data }: { data: ReviewerPayload }) {
  return (
    <div>
      <h3 className="text-[15px] font-bold mb-2 flex items-center gap-1.5">
        📄 {data.title}
      </h3>
      <div className="text-sm text-slate-700">
        <Markdown text={data.content} />
      </div>
    </div>
  );
}

// ---------- Flashcards ----------
function FlashcardsView({ data }: { data: FlashcardsPayload }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const toggle = (idx: number) =>
    setFlipped((s) => {
      const next = new Set(s);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  return (
    <div>
      <h3 className="text-[15px] font-bold mb-3 flex items-center gap-1.5">
        🃏 {data.title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.cards.map((c, idx) => {
          const isFlipped = flipped.has(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              className={`text-left rounded-xl border p-4 text-sm min-h-[92px] flex flex-col justify-center transition
                ${isFlipped ? "bg-primary-50 border-primary-200" : "bg-white border-slate-200 hover:border-accent"}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {isFlipped ? "Answer" : `Card ${idx + 1}`}
              </span>
              <span className="font-medium text-slate-800">
                {isFlipped ? c.back : c.front}
              </span>
              <span className="text-[11px] text-slate-400 mt-1.5">
                Tap to {isFlipped ? "flip back" : "reveal"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Quiz ----------
function QuizView({ data }: { data: QuizPayload }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const choose = (qIdx: number, optIdx: number) => {
    if (answers[qIdx] !== undefined) return; // lock after first pick
    setAnswers((a) => ({ ...a, [qIdx]: optIdx }));
  };

  const answeredCount = Object.keys(answers).length;
  const correctCount = data.questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
    0,
  );
  const allAnswered = answeredCount === data.questions.length;
  const scorePercent = data.questions.length
    ? Math.round((correctCount / data.questions.length) * 100)
    : 0;
  const passed = scorePercent >= data.passing_percent;

  const retake = () => setAnswers({});

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-bold flex items-center gap-1.5">
          ❓ {data.title}
        </h3>
        {allAnswered && (
          <button
            onClick={retake}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-accent"
          >
            <RefreshCw size={12} /> Retake
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-3">
        {data.duration_minutes} min · Passing: {data.passing_percent}%
      </p>

      <div className="space-y-4">
        {data.questions.map((q, qIdx) => {
          const chosen = answers[qIdx];
          const isAnswered = chosen !== undefined;
          return (
            <div
              key={qIdx}
              className="border border-slate-200 rounded-xl p-3.5"
            >
              <p className="text-sm font-semibold mb-2.5">
                {qIdx + 1}. {q.prompt}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, optIdx) => {
                  let cls = "bg-white border-slate-200 hover:border-accent";
                  if (isAnswered) {
                    if (optIdx === q.correct_index)
                      cls = "bg-emerald-50 border-emerald-300 text-emerald-800";
                    else if (optIdx === chosen)
                      cls = "bg-red-50 border-red-300 text-red-700";
                    else cls = "bg-white border-slate-200 opacity-60";
                  }
                  return (
                    <button
                      key={optIdx}
                      onClick={() => choose(qIdx, optIdx)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg border flex items-center justify-between transition ${cls}`}
                    >
                      <span>{opt}</span>
                      {isAnswered && optIdx === q.correct_index && (
                        <Check
                          size={14}
                          className="text-emerald-600 shrink-0"
                        />
                      )}
                      {isAnswered &&
                        optIdx === chosen &&
                        optIdx !== q.correct_index && (
                          <X size={14} className="text-red-500 shrink-0" />
                        )}
                    </button>
                  );
                })}
              </div>
              {isAnswered && (
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  <span className="font-semibold text-slate-600">
                    Explanation:{" "}
                  </span>
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {allAnswered && (
        <div
          className={`mt-4 rounded-xl p-3.5 text-sm font-semibold ${passed ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
        >
          Score: {correctCount}/{data.questions.length} ({scorePercent}%) —{" "}
          {passed ? "Passed 🎉" : "Not yet — try again"}
        </div>
      )}
    </div>
  );
}

// ---------- Dispatcher ----------
function StructuredView({ data }: { data: Structured }) {
  switch (data.type) {
    case "quiz":
      return <QuizView data={data} />;
    case "flashcards":
      return <FlashcardsView data={data} />;
    case "reviewer":
      return <ReviewerView data={data} />;
    case "text":
    default:
      return (
        <div className="text-sm text-slate-700">
          <Markdown text={data.text} />
        </div>
      );
  }
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function fillTemplate(template: string) {
    setInput(template);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const start = template.indexOf("[");
      const end = template.indexOf("]") + 1;
      if (start !== -1 && end !== -1) el.setSelectionRange(start, end);
    });
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);

    // Calls the built-in Next.js API route (app/api/ai-chat/route.ts)
    let structured: Structured;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        structured = {
          type: "text",
          text: "You must be logged in to use BrainForge AI.",
        };

        setMessages((m) => [...m, { role: "assistant", structured }]);
        setBusy(false);
        return;
      }

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          messages: next.map(m => ({
            role: m.role,
            content: m.content ?? '',
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.remaining !== undefined) {
        setRemaining(data.remaining);
      }
      if (!res.ok || data.error) {
        // Show the REAL error from the server so problems are easy to diagnose
        structured = {
          type: "text",
          text: data.error ?? "Something went wrong. Please try again later.",
        };
      } else if (data.structured) {
        structured = data.structured as Structured;
      } else {
        structured = {
          type: "text",
          text: "Sorry, I could not generate a response.",
        };
      }
    } catch (err) {
      structured = {
        type: "text",
        text:
          `⚠️ Could not reach /api/ai-chat at all: ${String(err)}\n\n` +
          "This usually means the route file is missing — confirm the file exists at exactly app/api/ai-chat/route.ts, then restart the dev server.",
      };
    }
    setMessages((m) => [...m, { role: "assistant", structured }]);
    setBusy(false);
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        }),
      50,
    );
  }

  function handleNewChat() {
    if (messages.length === 0) {
      restart();
      return;
    }

    setOpen(true);
  }

  function restart() {
    setMessages([]);
    setInput("");
    setBusy(false);
    setOpen(false);
  }

  return (
    <div className="page-in flex flex-col h-[calc(100vh-3.5rem)] w-full max-w-3xl mx-auto px-3 sm:px-4 lg:px-0">
      {messages.length > 0 && (
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-3 border-b border-slate-200 mb-1">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-white">
              <Sparkles size={13} />
            </span>
            AI Assistant
          </div>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
              title="Clear the conversation and ask about something new"
            >
              <RotateCcw size={13} /> New chat
            </button>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new chat?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your current conversation will be permanently cleared.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={restart}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {messages.length === 0 && (
        <div className="text-center pt-10 pb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-white mx-auto mb-4 animate-pulse">
            <Sparkles size={26} />
          </div>
          <h1 className="text-2xl font-semibold">
            What are we mastering today?
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Generate reviewers, quizzes, flashcards — or just ask anything.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {capabilities.map((c) => (
              <button
                key={c.label}
                onClick={() => fillTemplate(c.template)}
                className="bg-white border border-slate-200 rounded-xl p-3.5 text-left text-[13px] font-semibold hover:border-accent hover:text-accent transition"
              >
                <span className="text-lg block mb-1.5">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4 pb-24 space-y-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2.5 page-in ${m.role === "user" ? "justify-end" : ""}`}
          >
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-white shrink-0">
                <Sparkles size={14} />
              </div>
            )}
            <div
              className={`max-w-[92%] sm:max-w-[82%] lg:max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed
              ${m.role === "user" ? "bg-primary-50 border border-primary-100 whitespace-pre-wrap" : "bg-white border border-slate-200"}`}
            >
              {m.role === "user"
                ? m.content
                : m.structured && <StructuredView data={m.structured} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-white shrink-0">
              <Sparkles size={14} />
            </div>
            <Card className="px-4 py-3 text-sm text-slate-400">Thinking…</Card>
          </div>
        )}
      </div>

      {remaining !== null && (
        <div className="text-center text-xs text-slate-500 mb-2">
          ✨ {remaining} AI chats remaining today
          </div>
      )}
      <div className="sticky md:bottom-3 bottom-12 mt-2 flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-lift z-10">
        <input
          ref={inputRef}
          className="flex-1 outline-none text-sm px-2 py-4"
          placeholder="Ask anything… (Enter to send)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={() => send()}
          disabled={busy}
          className="w-9 h-9 rounded-xl bg-accent text-white grid place-items-center hover:brightness-110 disabled:opacity-50 transition"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
