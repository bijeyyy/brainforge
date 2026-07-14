"use client";

import ReactMarkdown from "react-markdown";
import { useRef, useState } from "react";
import { RotateCcw, Send, Sparkles } from "lucide-react";
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
import {
  saveGeneratedQuiz,
  saveGeneratedFlashcards,
  saveGeneratedReviewer,
} from "@/lib/api";

interface ActionMsg {
  role: "assistant";
  kind: "action";
  label: string;
  href: string;
  cta: string;
}
interface TextMsg {
  role: "user" | "assistant";
  kind: "text";
  text: string;
}
type Msg = ActionMsg | TextMsg;

const capabilities = [
  {
    icon: "🎙️",
    label: "Explain Back to Me",
    prompt:
      "I'll explain a topic in my own words and you check if I got it right, point out what I missed, and correct any misunderstanding. Ask me first what topic I want to explain.",
  },
  {
    icon: "🧩",
    label: "Break This Down",
    prompt:
      "Help me break down a difficult paragraph, problem, or concept into simple steps with an analogy. Ask me to paste or describe what I need broken down.",
  },
  {
    icon: "🔄",
    label: "Turn This Into...",
    prompt:
      "Help me turn a topic into a different format to help me understand it better — like a mnemonic, a story, an analogy, or a simple diagram description. Ask me what topic and what format I want first.",
  },
  {
    icon: "⏱️",
    label: "Quick Recall Check",
    prompt:
      "Give me 2-3 quick random questions to check if I remember what we just talked about, or ask me what topic to check first if this is a new conversation.",
  },
  {
    icon: "🧭",
    label: "I'm Stuck, Help Me Think",
    prompt:
      "I'm stuck on a problem. Instead of giving me the answer directly, guide me with questions so I can figure it out myself. Ask me what I'm working on first.",
  },
  {
    icon: "📌",
    label: "Explain the 'Why'",
    prompt:
      "Explain not just what a topic is, but why it matters and why it works that way. Ask me what topic I want to understand more deeply.",
  },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next: Msg[] = [
      ...messages,
      { role: "user", kind: "text", text: content },
    ];
    setMessages(next);
    setBusy(true);

    // Calls the built-in Next.js API route (app/api/ai-chat/route.ts)
    let reply: Msg;
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({
            role: m.role,
            content: m.kind === "text" ? m.text : m.label,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        reply = {
          role: "assistant",
          kind: "text",
          text:
            `⚠️ AI route error (HTTP ${res.status}):\n${data.error ?? "Unknown error — no message returned."}\n\n` +
            "Checklist: (1) app/api/ai-chat/route.ts contains your provider code, " +
            "(2) the matching key (e.g. GROQ_API_KEY) is in .env.local, " +
            "(3) you restarted the dev server after editing .env.local.",
        };
      } else {
        const s = data.structured;
        try {
          if (s.type === "quiz") {
            const r = await saveGeneratedQuiz(s.title, s.questions, s);
            reply = {
              role: "assistant",
              kind: "action",
              label: `✅ Quiz na-generate: "${r.title}" (${r.count} items)`,
              href: `/quizzes/${r.id}`,
              cta: "Kunin ang Quiz →",
            };
          } else if (s.type === "flashcards") {
            const r = await saveGeneratedFlashcards(s.title, s.cards);
            reply = {
              role: "assistant",
              kind: "action",
              label: `✅ Deck na-generate: "${r.title}" (${r.count} cards)`,
              href: `/decks/${r.id}`,
              cta: "Tignan ang Flashcards →",
            };
          } else if (s.type === "reviewer") {
            const r = await saveGeneratedReviewer(s.title, s.content);
            reply = {
              role: "assistant",
              kind: "action",
              label: `✅ Reviewer na-generate: "${r.title}"`,
              href: `/reviewers/${r.id}`,
              cta: "Buksan ang Reviewer →",
            };
          } else {
            reply = {
              role: "assistant",
              kind: "text",
              text: s.text ?? "Sorry, I could not generate a response.",
            };
          }
        } catch (saveErr) {
          reply = {
            role: "assistant",
            kind: "text",
            text: `⚠️ Nagawa ang content pero hindi na-save sa database:\n${String(saveErr)}`,
          };
        }
      }
    } catch (err) {
      reply = {
        role: "assistant",
        kind: "text",
        text:
          `⚠️ Could not reach /api/ai-chat at all: ${String(err)}\n\n` +
          "This usually means the route file is missing — confirm the file exists at exactly app/api/ai-chat/route.ts, then restart the dev server.",
      };
    }
    setMessages((m) => [...m, reply]);
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
    <div className="page-in flex flex-col h-[calc(100vh-3.5rem)] max-w-3xl mx-auto">
      {messages.length > 0 && (
        <div className="flex items-center justify-between py-3 border-b border-slate-200 mb-1">
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
          <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2.5">
            {capabilities.map((c) => (
              <button
                key={c.label}
                onClick={() => send(c.prompt)}
                className="bg-white border border-slate-200 rounded-xl p-3.5 text-left text-[13px] font-semibold hover:border-accent hover:text-accent transition cursor-pointer"
              >
                <span className="text-lg block mb-1.5">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-4">
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
            {m.kind === "action" ? (
              <Card className="max-w-[78%] px-4 py-3 rounded-2xl text-sm bg-white border border-slate-200 space-y-2">
                <p className="leading-relaxed">{m.label}</p>
                <a
                  href={m.href}
                  className="inline-flex items-center gap-1 text-accent font-semibold text-xs hover:underline"
                >
                  {m.cta}
                </a>
              </Card>
            ) : (
              <div
                className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-primary-50 border border-primary-100" : "bg-white border border-slate-200"}`}>
                {m.role === "assistant" ? (
                  <div className="markdown-body">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{m.text}</span>
                )}
              </div>
            )}
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

      <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-lift mb-2">
        <input
          className="flex-1 outline-none text-sm px-2"
          placeholder="Ask anything… (Enter to send)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={() => send()}
          disabled={busy}
          className="w-9 h-9 rounded-xl bg-accent text-white grid place-items-center hover:brightness-110 disabled:opacity-50 transition cursor-pointer"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
