"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Star, Trash2, FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addXp, todayISO } from "@/lib/api";
import { Deck, Flashcard } from "@/types";
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

export default function Flashcards() {
  const { refreshProfile } = useProfile();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [graded, setGraded] = useState({ again: 0, good: 0, easy: 0 });
  const [done, setDone] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);

  async function loadDecks() {
    const { data } = await supabase
      .from("flashcard_decks")
      .select("*, flashcards(count)")
      .order("created_at");
    setDecks((data as Deck[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    loadDecks();
  }, []);

  // ── Create deck + manage cards ──
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState("");
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [editorCards, setEditorCards] = useState<Flashcard[]>([]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  // ── PDF -> AI flashcards ──
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);

  async function createDeck() {
    if (!newDeckTitle.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("flashcard_decks")
      .insert({ user_id: u.user!.id, title: newDeckTitle.trim() })
      .select()
      .single();
    if (error) {
      alert("Could not create deck: " + error.message);
      return;
    }
    setNewDeckTitle("");
    setShowNewDeck(false);
    await loadDecks();
    openEditor(data as Deck); // jump straight into adding cards
  }

  async function openEditor(deck: Deck) {
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .eq("deck_id", deck.id)
      .order("created_at");
    setEditorCards((data as Flashcard[]) ?? []);
    setEditingDeck(deck);
  }

  async function addCard() {
    if (!front.trim() || !back.trim()) {
      alert("Fill in both the front and the back of the card.");
      return;
    }
    const { error } = await supabase.from("flashcards").insert({
      deck_id: editingDeck!.id,
      front: front.trim(),
      back: back.trim(),
    });
    if (error) {
      alert("Could not add card: " + error.message);
      return;
    }
    setFront("");
    setBack("");
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .eq("deck_id", editingDeck!.id)
      .order("created_at");
    setEditorCards((data as Flashcard[]) ?? []);
  }

  async function deleteCard(id: string) {
    await supabase.from("flashcards").delete().eq("id", id);
    setEditorCards((cs) => cs.filter((c) => c.id !== id));
  }

  function requestDeleteDeck(deck: Deck) {
    setDeckToDelete(deck);
  }

  async function confirmDeleteDeck() {
    if (!deckToDelete) return;
    const deck = deckToDelete;
    setDeckToDelete(null);

    const { error } = await supabase
      .from("flashcard_decks")
      .delete()
      .eq("id", deck.id);
    if (error) {
      alert("Could not delete deck: " + error.message);
      return;
    }
    setDecks((ds) => ds.filter((d) => d.id !== deck.id));
  }

  // Upload a PDF, ask the AI to turn it into flashcards, bulk-insert the result
  async function handlePdfUpload(file: File) {
    if (!editingDeck) return;
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

      setPdfProgress("Asking AI to generate flashcards…");
      const res = await fetch("/api/generate-flashcards", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const { cards: generated } = (await res.json()) as {
        cards: { front: string; back: string }[];
      };

      if (!generated?.length) {
        throw new Error(
          "The AI could not find enough content to make flashcards from this PDF.",
        );
      }

      setPdfProgress(`Saving ${generated.length} cards…`);
      const { error } = await supabase.from("flashcards").insert(
        generated.map((c) => ({
          deck_id: editingDeck.id,
          front: c.front.trim(),
          back: c.back.trim(),
        })),
      );
      if (error) throw new Error(error.message);

      const { data } = await supabase
        .from("flashcards")
        .select("*")
        .eq("deck_id", editingDeck.id)
        .order("created_at");
      setEditorCards((data as Flashcard[]) ?? []);
    } catch (err: any) {
      setPdfError(
        err.message ??
          "Something went wrong generating flashcards from that PDF.",
      );
    } finally {
      setUploadingPdf(false);
      setPdfProgress(null);
    }
  }

  async function openDeck(deck: Deck) {
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .eq("deck_id", deck.id)
      .order("due_date");
    const all = (data as Flashcard[]) ?? [];
    // Due cards first (spaced repetition); fall back to the whole deck
    const due = all.filter((c) => c.due_date <= todayISO());
    setCards(due.length ? due : all);
    setActiveDeck(deck);
    setIndex(0);
    setFlipped(false);
    setDone(false);
    setGraded({ again: 0, good: 0, easy: 0 });
  }

  /** SRS grading: Again = due today again, Good = +1 day (or double), Easy = +4 days (or 2.5x) */
  async function grade(kind: "again" | "good" | "easy") {
    const card = cards[index];
    const next =
      kind === "again"
        ? 0
        : kind === "good"
          ? Math.max(1, card.interval_days * 2)
          : Math.max(4, Math.round(card.interval_days * 2.5));
    const due = new Date();
    due.setDate(due.getDate() + next);
    await supabase
      .from("flashcards")
      .update({ interval_days: next, due_date: due.toISOString().slice(0, 10) })
      .eq("id", card.id);

    setGraded((g) => ({ ...g, [kind]: g[kind] + 1 }));
    if (index + 1 >= cards.length) {
      setDone(true);
      const xp = cards.length * 3;
      await addXp(xp, `Flashcard session: ${activeDeck?.title}`);
      refreshProfile();
    } else {
      setFlipped(false);
      setTimeout(() => setIndex((i) => i + 1), 260);
    }
  }

  async function toggleFavorite() {
    const card = cards[index];
    await supabase
      .from("flashcards")
      .update({ is_favorite: !card.is_favorite })
      .eq("id", card.id);
    setCards((cs) =>
      cs.map((c, i) =>
        i === index ? { ...c, is_favorite: !c.is_favorite } : c,
      ),
    );
  }

  if (loading) return <Spinner />;

  // ── Deck editor (add / remove cards) ──
  if (editingDeck) {
    const inputCls =
      "w-full h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary transition";
    return (
      <div className="page-in max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => {
              setEditingDeck(null);
              loadDecks();
            }}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold flex-1">{editingDeck.title}</h1>
          <span className="text-sm text-slate-500">
            {editorCards.length} card{editorCards.length === 1 ? "" : "s"}
          </span>
        </div>

        <Card className="p-5 mb-5">
          <h3 className="font-semibold mb-3">Generate from a PDF</h3>
          <p className="text-xs text-slate-500 mb-3">
            Upload your notes or a reviewer and the AI will turn them into
            flashcards automatically.
          </p>
          <label
            className={`flex items-center justify-center gap-2 h-10 px-3.5 rounded-[10px] border border-dashed text-sm cursor-pointer transition
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
                e.target.value = ""; // allow re-selecting the same file later
                if (file) handlePdfUpload(file);
              }}
            />
          </label>
          {pdfError && <p className="text-xs text-red-500 mt-2">{pdfError}</p>}
        </Card>

        <Card className="p-5 mb-5">
          <h3 className="font-semibold mb-3">Add a card manually</h3>
          <div className="space-y-2.5 mb-3">
            <input
              className={inputCls}
              placeholder="Front — the question or term"
              value={front}
              onChange={(e) => setFront(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Back — the answer or definition"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCard()}
            />
          </div>
          <Btn onClick={addCard}>
            <Plus size={15} /> Add card
          </Btn>
        </Card>

        {editorCards.length === 0 ? (
          <p className="text-sm text-slate-400 text-center">
            No cards yet — upload a PDF or add your first one above.
          </p>
        ) : (
          <Card className="divide-y divide-slate-100">
            {editorCards.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-4 text-sm">
                <div className="flex-1">
                  <div className="font-medium">{c.front}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.back}</div>
                </div>
                <button
                  onClick={() => deleteCard(c.id)}
                  className="text-slate-300 hover:text-red-500"
                  title="Delete card"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  // ── Study mode ──
  if (activeDeck) {
    if (done) {
      return (
        <div className="page-in max-w-md mx-auto text-center pt-16">
          <Card className="p-8">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-xl font-semibold mb-1">Session complete!</h2>
            <p className="text-sm text-slate-500 mb-4">
              +{cards.length * 3} XP earned
            </p>
            <div className="flex justify-center gap-2 mb-6">
              <Pill tone="red">{graded.again} Again</Pill>
              <Pill tone="amber">{graded.good} Good</Pill>
              <Pill tone="green">{graded.easy} Easy</Pill>
            </div>
            <Btn
              onClick={() => {
                setActiveDeck(null);
                loadDecks();
              }}
            >
              Back to decks
            </Btn>
          </Card>
        </div>
      );
    }

    const card = cards[index];
    return (
      <div className="page-in max-w-xl mx-auto">
        <div className="flex items-center gap-3 text-sm text-slate-500 mb-5">
          <button
            onClick={() => setActiveDeck(null)}
            className="hover:text-slate-900"
          >
            ← Exit
          </button>
          <span>
            {index + 1} / {cards.length}
          </span>
          <ProgressBar
            value={((index + 1) / cards.length) * 100}
            className="flex-1"
          />
          <Pill tone="violet">{activeDeck.title}</Pill>
        </div>

        <div className="flip-scene mb-6">
          <div
            className={`flip-card relative h-80 cursor-pointer ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
          >
            <div className="flip-face absolute inset-0 bg-white border border-slate-200 rounded-3xl shadow-lift flex flex-col items-center justify-center p-9 text-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite();
                }}
                className="absolute top-4 right-5"
              >
                <Star
                  size={18}
                  className={
                    card.is_favorite
                      ? "text-amber-400 fill-amber-400"
                      : "text-slate-300"
                  }
                />
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Question
              </span>
              <div className="font-display text-xl font-semibold leading-snug">
                {card.front}
              </div>
              <span className="absolute bottom-4 text-xs text-slate-400">
                Tap to flip
              </span>
            </div>
            <div className="flip-face flip-back absolute inset-0 bg-primary-50 border border-primary-100 rounded-3xl shadow-lift flex flex-col items-center justify-center p-9 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Answer
              </span>
              <div className="font-display text-xl font-semibold">
                {card.back}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`flex gap-3 justify-center transition-all duration-300 ${flipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
        >
          <button
            onClick={() => grade("again")}
            className="flex-1 max-w-36 py-3 rounded-xl bg-red-50 text-red-700 font-semibold text-sm hover:-translate-y-0.5 transition"
          >
            Again
            <span className="block text-[11px] font-medium opacity-70">
              &lt; 1 min
            </span>
          </button>
          <button
            onClick={() => grade("good")}
            className="flex-1 max-w-36 py-3 rounded-xl bg-amber-50 text-amber-700 font-semibold text-sm hover:-translate-y-0.5 transition"
          >
            Good
            <span className="block text-[11px] font-medium opacity-70">
              +{Math.max(1, card.interval_days * 2)}d
            </span>
          </button>
          <button
            onClick={() => grade("easy")}
            className="flex-1 max-w-36 py-3 rounded-xl bg-green-50 text-green-700 font-semibold text-sm hover:-translate-y-0.5 transition"
          >
            Easy
            <span className="block text-[11px] font-medium opacity-70">
              +{Math.max(4, Math.round(card.interval_days * 2.5))}d
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── Deck library ──
  return (
    <div className="page-in">
      <PageHeader
        title="Flashcards"
        sub="Spaced repetition — clear your due cards daily"
        action={
          <Btn onClick={() => setShowNewDeck((v) => !v)}>
            <Plus size={16} /> New deck
          </Btn>
        }
      />
      {showNewDeck && (
        <Card className="p-4 mb-5 flex gap-3 items-center flex-wrap">
          <input
            className="h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm flex-1 min-w-48 outline-none focus:ring-2 focus:ring-primary transition"
            placeholder="Deck title (e.g. Taxation — Key Doctrines)"
            value={newDeckTitle}
            onChange={(e) => setNewDeckTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createDeck()}
          />
          <Btn onClick={createDeck}>Create deck</Btn>
        </Card>
      )}
      {decks.length === 0 ? (
        <Empty
          icon="🃏"
          title="No decks yet"
          sub="Click New deck above to build your own."
        />
      ) : (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
          {decks.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="w-11 h-11 rounded-xl bg-accent-50 grid place-items-center text-xl mb-3">
                🃏
              </div>
              <h3 className="font-semibold">{d.title}</h3>
              <p className="text-xs text-slate-500 mb-3">
                {d.flashcards?.[0]?.count ?? 0} cards
              </p>
              <div className="flex gap-2">
                <Btn
                  className="flex-1"
                  onClick={() => openDeck(d)}
                  disabled={(d.flashcards?.[0]?.count ?? 0) === 0}
                >
                  Study →
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => openEditor(d)}
                  title="Add or edit cards"
                >
                  <Pencil size={15} />
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => requestDeleteDeck(d)}
                  title="Delete deck"
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
        open={!!deckToDelete}
        onOpenChange={(open) => !open && setDeckToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deckToDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all its flashcards. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDeck}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
