"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload, Star } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";
import { Reviewer } from "@/types";
import { Btn, Card, Empty, PageHeader, Spinner } from "@/components/ui";
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

type UploadStatus = {
  fileName: string;
  status: "uploading" | "generating" | "done" | "error";
  error?: string;
};

// Cycle of pastel accents used to color-code sections & highlights
const ACCENTS = [
  { bg: "#FFE3EC", ring: "#FF9EB5", dot: "#FF6B93" }, // pink
  { bg: "#E9E3FF", ring: "#C3B4FF", dot: "#9C85FF" }, // lavender
  { bg: "#DFF7EC", ring: "#94E2C4", dot: "#4CC99A" }, // mint
  { bg: "#FFEBD9", ring: "#FFCBA4", dot: "#FF9F5A" }, // peach
];

export default function Reviewers() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Reviewer | null>(null);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [reviewerToDelete, setReviewerToDelete] = useState<Reviewer | null>(
    null,
  );

  async function load() {
    const { data } = await supabase
      .from("reviewers")
      .select("*")
      .order("created_at", { ascending: false });
    setReviewers((data as Reviewer[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { data: user } = await supabase.auth.getUser();
    const fileArr = Array.from(files).filter(
      (f) => f.type === "application/pdf",
    );
    if (fileArr.length === 0) {
      alert("Please select PDF files only.");
      return;
    }

    setUploads(fileArr.map((f) => ({ fileName: f.name, status: "uploading" })));

    await Promise.all(
      fileArr.map(async (file, i) => {
        try {
          const path = `${user.user!.id}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("pdfs")
            .upload(path, file);
          if (upErr) throw new Error(upErr.message);

          setUploads((u) =>
            u.map((x, idx) => (idx === i ? { ...x, status: "generating" } : x)),
          );

          const title = file.name.replace(/\.pdf$/i, "");
          const res = await fetch("/api/generate-reviewer", {
            method: "POST",
            body: JSON.stringify({
              userId: user.user!.id,
              storagePath: path,
              title,
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error ?? "Generation failed");

          setUploads((u) =>
            u.map((x, idx) => (idx === i ? { ...x, status: "done" } : x)),
          );
        } catch (e) {
          setUploads((u) =>
            u.map((x, idx) =>
              idx === i
                ? { ...x, status: "error", error: (e as Error).message }
                : x,
            ),
          );
        }
      }),
    );

    await load();
    setTimeout(() => setUploads([]), 2500);
  }

  function requestRemove(reviewer: Reviewer) {
    setReviewerToDelete(reviewer);
  }

  async function confirmRemove() {
    if (!reviewerToDelete) return;
    const reviewer = reviewerToDelete;
    setReviewerToDelete(null);

    await supabase.from("reviewers").delete().eq("id", reviewer.id);
    if (active?.id === reviewer.id) setActive(null);
    load();
  }

  if (loading) return <Spinner />;

  if (active) {
    // Reset the color cycle counter each render of the active reviewer
    let colorIndex = 0;

    return (
      <div className="page-in max-w-3xl mx-auto">
        {/* Google Fonts — move this <link> to app/layout.tsx <head> if you have one, so it's not refetched every navigation */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@400;500;600;700&display=swap"
        />

        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setActive(null)}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back
          </button>
          <h1
            className="text-xl font-semibold flex-1"
            style={{ fontFamily: "Quicksand, sans-serif" }}
          >
            {active.title}
          </h1>
          <button
            onClick={() => requestRemove(active)}
            className="text-slate-300 hover:text-red-500"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div
          className="relative rounded-[28px] p-8 sm:p-10 shadow-[0_8px_30px_rgba(59,54,84,0.08)] overflow-hidden"
          style={{
            background: "#FFFDF8",
            backgroundImage: "radial-gradient(#EFE9DD 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            fontFamily: "Quicksand, sans-serif",
            color: "#3B3654",
          }}
        >
          {/* washi tape corners — the one signature flourish */}
          <div
            className="absolute -top-2 left-10 w-20 h-7 rotate-[-8deg] rounded-sm opacity-90"
            style={{
              background:
                "repeating-linear-gradient(45deg, #FF9EB5, #FF9EB5 6px, #FFC2D4 6px, #FFC2D4 12px)",
            }}
          />
          <div
            className="absolute -top-3 right-14 w-16 h-7 rotate-[10deg] rounded-sm opacity-90"
            style={{
              background:
                "repeating-linear-gradient(45deg, #C3B4FF, #C3B4FF 6px, #DCD2FF 6px, #DCD2FF 12px)",
            }}
          />

          <div
            className="reviewer-content max-w-none"
            style={{
              fontFamily: "Quicksand, sans-serif",
              lineHeight: 1.75,
              fontSize: "15.5px",
            }}
          >
            <ReactMarkdown
              components={{
                h2: ({ children }) => {
                  const text = String(children);
                  const isKeyPointers = /key pointers/i.test(text);
                  const accent = ACCENTS[colorIndex % ACCENTS.length];
                  colorIndex++;

                  if (isKeyPointers) {
                    return (
                      <div
                        className="mt-10 mb-4 rounded-2xl px-5 py-3 flex items-center gap-2"
                        style={{
                          background: "#FFF4CC",
                          border: "2px dashed #F2C94C",
                        }}
                      >
                        <Star
                          size={20}
                          className="fill-amber-400 text-amber-400 shrink-0"
                        />
                        <h2
                          className="text-xl font-semibold m-0"
                          style={{
                            fontFamily: "Fredoka, sans-serif",
                            color: "#8A6D1E",
                          }}
                        >
                          {children}
                        </h2>
                      </div>
                    );
                  }

                  return (
                    <h2
                      className="mt-9 mb-3 text-[1.35rem] font-semibold inline-flex items-center gap-2 pb-1"
                      style={{
                        fontFamily: "Fredoka, sans-serif",
                        color: "#3B3654",
                        borderBottom: `4px solid ${accent.ring}`,
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: accent.dot }}
                      />
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => (
                  <h3
                    className="mt-6 mb-2 text-[1.05rem] font-semibold"
                    style={{
                      fontFamily: "Fredoka, sans-serif",
                      color: "#57517A",
                    }}
                  >
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="my-3 text-[15px]">{children}</p>
                ),
                strong: ({ children }) => (
                  <span
                    className="font-semibold px-1.5 py-0.5 rounded-md inline-block"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 55%, #FFEA8A 55%)",
                      transform: "rotate(-0.4deg)",
                      color: "#2E2A47",
                    }}
                  >
                    {children}
                  </span>
                ),
                ul: ({ children }) => (
                  <ul className="my-3 space-y-2 pl-0 list-none">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="flex gap-2.5 items-start">
                    <span
                      className="mt-2 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "#C3B4FF" }}
                    />
                    <span>{children}</span>
                  </li>
                ),
                hr: () => (
                  <div
                    className="my-8 h-[2px] rounded-full"
                    style={{ background: "#F0EAD9" }}
                  />
                ),
              }}
            >
              {active.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-in">
      <PageHeader
        title="Reviewers"
        sub="Upload a PDF and get an instant AI-made study reviewer"
        action={
          <Btn onClick={() => inputRef.current?.click()}>
            <Upload size={16} /> Upload PDF
          </Btn>
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {uploads.length > 0 && (
        <Card className="p-4 mb-5 space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <FileText size={15} className="text-slate-400 shrink-0" />
              <span className="flex-1 truncate">{u.fileName}</span>
              {u.status === "uploading" && (
                <span className="text-xs text-slate-400">Uploading…</span>
              )}
              {u.status === "generating" && (
                <span className="text-xs text-primary">
                  ✨ Generating reviewer…
                </span>
              )}
              {u.status === "done" && (
                <span className="text-xs text-green-600">✓ Done</span>
              )}
              {u.status === "error" && (
                <span className="text-xs text-red-500">✕ {u.error}</span>
              )}
            </div>
          ))}
        </Card>
      )}

      {reviewers.length === 0 && uploads.length === 0 ? (
        <Empty
          icon="📄"
          title="No reviewers yet"
          sub="Upload one or more PDFs (notes, textbook chapters) and AI will turn them into a highlighted study reviewer."
        />
      ) : (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
          {reviewers.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="w-11 h-11 rounded-xl bg-primary-50 grid place-items-center text-xl mb-3">
                📄
              </div>
              <h3 className="font-semibold truncate">{r.title}</h3>
              <p className="text-xs text-slate-500 mb-3">
                {new Date(r.created_at).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <Btn className="flex-1" onClick={() => setActive(r)}>
                  Read →
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => requestRemove(r)}
                  title="Delete">
                  <Trash2 size={15} />
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog
        open={!!reviewerToDelete}
        onOpenChange={(open) => !open && setReviewerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete "{reviewerToDelete?.title}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
