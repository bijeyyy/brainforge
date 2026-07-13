# 🔥 BrainForge AI — Next.js + Supabase

AI-powered review platform — subjects, spaced-repetition flashcards, quizzes, mock exams, daily challenge, leaderboard, progress analytics, and an AI study assistant.

**Stack:** Next.js 14 (App Router) + TypeScript + TailwindCSS + Supabase (auth + database) + Lucide icons. The AI Assistant runs through a built-in Next.js API route.

---

## 📁 Project structure

```
brainforge-next/
├── app/
│   ├── layout.tsx                 ← root layout (Poppins + Inter fonts)
│   ├── globals.css
│   ├── login/page.tsx             ← login / register
│   ├── api/ai-chat/route.ts       ← server route that calls the Anthropic API
│   └── (app)/                     ← everything behind login
│       ├── layout.tsx             ← wraps pages in the AppShell (sidebar + auth gate)
│       ├── page.tsx               ← Dashboard        (route: /)
│       ├── subjects/page.tsx      ← Subjects         (route: /subjects)
│       ├── flashcards/page.tsx    ← Flashcards       (route: /flashcards)
│       ├── quizzes/page.tsx       ← Quizzes          (route: /quizzes)
│       ├── mock-exam/page.tsx     ← Mock Exams       (route: /mock-exam)
│       ├── assistant/page.tsx     ← AI Assistant     (route: /assistant)
│       ├── challenge/page.tsx     ← Daily Challenge  (route: /challenge)
│       ├── leaderboard/page.tsx   ← Leaderboard      (route: /leaderboard)
│       └── progress/page.tsx      ← Progress         (route: /progress)
├── components/
│   ├── AppShell.tsx               ← sidebar, session guard, profile context
│   ├── ui.tsx                     ← Card, Btn, Pill, ProgressBar, Empty, Spinner
│   └── pages/                     ← the actual page code, one file each:
│       Dashboard.tsx · Subjects.tsx · Flashcards.tsx · Quizzes.tsx ·
│       MockExam.tsx · AIAssistant.tsx · DailyChallenge.tsx ·
│       Leaderboard.tsx · Progress.tsx · Login.tsx
├── lib/
│   ├── supabase.ts                ← Supabase browser client
│   └── api.ts                     ← addXp(), level math, date helpers
├── types.ts
├── supabase/
│   ├── schema.sql                 ← THE DATABASE — run in Supabase SQL Editor
│   └── functions/ai-chat/         ← optional edge-function alternative (not needed;
│                                    the Next.js API route already handles AI)
└── .env.local.example             ← copy to .env.local
```

The route files in `app/(app)/...` are one-liners that re-export from `components/pages/` — so your page code stays in clean, named files (Dashboard.tsx, Subjects.tsx, …) while Next.js gets the folder structure it needs for routing.

---

## 🚀 Setup — follow in order

### Step 1 · Prerequisites
- Node.js 18.17+ (`node -v`)
- A free account at https://supabase.com

### Step 2 · Create the Supabase project
1. https://supabase.com/dashboard → **New project** → name it `brainforge`, set a strong DB password, pick a nearby region (e.g. Singapore) → **Create**.
2. Wait ~2 minutes for provisioning.

### Step 3 · Create the database ⭐ (most important step)
1. In the project: **SQL Editor → New query**.
2. Copy the **entire** contents of `supabase/schema.sql` and paste it in.
3. Click **Run** → "Success. No rows returned."

That single script creates:

| What | Details |
|---|---|
| **10 tables** | `profiles`, `subjects`, `flashcard_decks`, `flashcards`, `quizzes`, `questions`, `quiz_attempts`, `xp_events`, `daily_challenges`, `daily_challenge_attempts` |
| **Signup trigger** | Auto-creates a `profiles` row for every new user |
| **`add_xp()` RPC** | Called after every session — adds XP + coins, logs an `xp_events` row, maintains the day streak |
| **`seed_demo_data()` RPC** | Powers the Dashboard's "Load demo data" button — sample subjects, deck, quiz, and mock exam |
| **Row Level Security** | Users only read/write their own rows (profiles + xp_events readable by all logged-in users so the leaderboard works) |

> ⚠️ Run it once only. To reset, use a fresh project (or drop the tables) and run again.

### Step 4 · Configure authentication
- **Authentication → Providers → Email**: enabled by default — leave it on.
- For easy testing, turn **OFF "Confirm email"** so new accounts log in instantly. Turn it back on before launch.

### Step 5 · Connect the app
1. Supabase → **Project Settings → API** → copy the **Project URL** and the **anon public** key (never the service_role key).
2. In the project folder:
   ```bash
   cp .env.local.example .env.local
   ```
3. Fill in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

### Step 6 · Install & run
```bash
npm install
npm run dev
```
Open http://localhost:3000 → you'll be redirected to **/login** → Sign up free → on the Dashboard click **Load demo data**. 🎉

---

## 🤖 AI Assistant setup (2 minutes)

The assistant posts to `/api/ai-chat` (see `app/api/ai-chat/route.ts`), which calls the Anthropic API **on the server** — your key never reaches the browser.

1. Get a key at https://console.anthropic.com
2. Add it to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
3. Restart `npm run dev`. Done — no edge function or CLI needed. (The `supabase/functions` folder is included only as an optional alternative if you'd rather host the AI on Supabase.)

---

## 📥 Merging into an EXISTING Next.js project (App Router)

If you already have a Next.js app and want to insert these files:

1. **Copy folders** into your project root: `components/`, `lib/`, `types.ts`, `supabase/`, and everything inside `app/` **except** `app/layout.tsx` and `app/globals.css` if you already have them.
2. **Root layout:** make sure your `app/layout.tsx` loads the fonts — copy the `Poppins`/`Inter` `next/font` lines and the `className={...variable}` from mine into yours.
3. **globals.css:** append the `@keyframes` and `.flip-*` blocks from my `globals.css` to yours (keep your Tailwind directives).
4. **Tailwind config:** merge my `theme.extend` (colors `primary`/`accent`, `fontFamily`, `borderRadius.card`, `boxShadow`) into your `tailwind.config`, and ensure `content` includes `./components/**/*.{ts,tsx}`.
5. **Install deps:**
   ```bash
   npm install @supabase/supabase-js lucide-react
   ```
6. Add the env vars to your `.env.local` (Step 5 above) and run the SQL (Step 3).
7. If your homepage `app/page.tsx` already exists and you want to keep it, move my dashboard route: delete `app/(app)/page.tsx` and create `app/(app)/dashboard/page.tsx` with the same one-line re-export, then change the `to: '/'` entry in `components/AppShell.tsx` to `to: '/dashboard'`.

> Using the older **pages/** router instead of the app/ directory? The components still work, but routing and the API route need small rewrites — ask me and I'll convert them.

---

## 🗄 How the data flows

- **Sign up** → DB trigger creates your `profiles` row.
- **Finish anything** (quiz, exam, deck, challenge) → app inserts an attempt row + calls `rpc('add_xp')` → XP, coins, streak, and `xp_events` update together.
- **Flashcards** = spaced repetition: *Again* → due today again · *Good* → interval ×2 · *Easy* → interval ×2.5 (min 4 days). Due cards are always served first.
- **Daily Challenge**: first player of the day writes the shared 5-question set into `daily_challenges`; one attempt per user per day (primary key enforces it).
- **Leaderboard**: all-time from `profiles.xp`; weekly aggregates the last 7 days of `xp_events`.

## 🧰 Common problems

| Problem | Fix |
|---|---|
| Console warning about missing env vars | Create `.env.local` (Step 5), restart the dev server |
| "relation public.profiles does not exist" | Run `supabase/schema.sql` (Step 3) |
| Sign-up works, login doesn't | Email confirmation is on — disable it (Step 4) or click the emailed link |
| "new row violates row-level security" | The whole `schema.sql` didn't run — redo on a fresh project |
| AI says "route not configured" | Add `ANTHROPIC_API_KEY` to `.env.local` and restart |
| Styles look unstyled after merging | Tailwind `content` doesn't include `./components/**` — fix your config |

## 📦 Deploy
Push to GitHub → import on Vercel → add the three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`) in Vercel's project settings → deploy.


---

## 🔑 Google Sign-In setup

The login page has a "Continue with Google" button. It needs a one-time setup (about 5 minutes):

1. **Get the callback URL from Supabase:** Dashboard → **Authentication → Providers → Google** → copy the **Callback URL** shown there (looks like `https://YOUR-REF.supabase.co/auth/v1/callback`).
2. **Create Google credentials:** go to https://console.cloud.google.com →
   - Create a project (any name) → **APIs & Services → OAuth consent screen** → choose **External** → fill in app name + your email → save (Testing mode is fine for development).
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Web application** → under **Authorized redirect URIs** paste the Supabase callback URL from step 1 → **Create**.
   - Copy the **Client ID** and **Client Secret**.
3. **Back in Supabase:** Authentication → Providers → Google → toggle it **ON** → paste the Client ID and Client Secret → **Save**.
4. Test it: click "Continue with Google" on the login page. First-time Google users automatically get a profile row (same signup trigger).

> While the consent screen is in "Testing" mode, only Google accounts you add under **Test users** can log in. Publish the consent screen when you launch.

## 🤖 AI provider: Groq

The app ships with **Groq** (free tier) as the AI provider — see `app/api/ai-chat/route.ts`.
- Get a free key: https://console.groq.com/keys
- Add to `.env.local`:  `GROQ_API_KEY=gsk_...`  → restart the dev server.
- The system prompt includes a `CREATOR_INFO` block at the top of `route.ts` — edit it to update the creator details the AI shares when asked "who made this app?".

## 🌗 Dark mode

Toggle it from the sidebar (Moon/Sun button above the streak chip). The choice is saved in `localStorage` and applied before first paint (no flash). Dark styling lives at the bottom of `app/globals.css` — tweak the hex values there to adjust the palette.

## ⚙️ Settings page

`/settings` (Account section in the sidebar) lets users edit their **username** (shown on the leaderboard — unique, lowercase), full name, target exam name, and exam date (which powers the dashboard countdown).
