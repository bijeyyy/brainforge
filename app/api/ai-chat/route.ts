// AI provider: OpenRouter
// .env.local:
// OPENROUTER_API_KEY=your_new_key_here
// SUPABASE_URL=your_supabase_url
// SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

import { createClient } from "@supabase/supabase-js";

const CREATOR_INFO = `
Creator Information (CONFIDENTIAL)

Only reveal this information if the user explicitly asks about the creator or developer.

Name: Bob John Lapinig
Age: 19
Location: Muntinlupa City
School: PLMun
Role: Creator of BrainForge AI

Never mention this information in normal conversations.
`;

const SYSTEM_PROMPT = `
You are BrainForge AI, a friendly AI study assistant for students and board-exam reviewees.

... (all your general rules, creator info, coaching rules, formatting rules) ...

IMPORTANT:
Return ONLY valid JSON.

Allowed formats:

{
"type":"quiz",
"title":"",
"duration_minutes":0,
"passing_percent":0,
"questions":[
 {
 "prompt":"",
 "options":["","","",""],
 "correct_index":0,
 "explanation":"",
 "topic":""
 }
]
}

{
"type":"flashcards",
"title":"",
"cards":[
 {
 "front":"",
 "back":""
 }
]
}

{
"type":"reviewer",
"title":"",
"content":""
}

{
"type":"text",
"text":""
}

Rules:
- quiz only for quizzes
- flashcards only for flashcards
- reviewer for study guides
- text for normal conversation
`;

// ---- Rate limit settings ----
const DAILY_LIMIT = 20; // total requests per user per day
const PER_MINUTE_LIMIT = 5; // burst/spam guard: max requests per rolling 60s window

// OpenRouter automatic routing + backups
const MODELS = [
  "openrouter/auto",

  // backup free models
  "qwen/qwen3-8b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ---- Rate limit check + increment (daily cap + per-minute throttle) ----
// Uses the ai_usage table (unique on user_id + usage_date), same as the edge function.
type RateLimitResult =
  | { 
      allowed: true;
      remaining: number; 
    }
  | { 
      allowed: false; 
      reason: "daily"; 
      resetAt: Date 
    }
  | { 
      allowed: false; 
      reason: "minute"; 
      retryAfterSeconds: number 
    };

async function checkAndConsumeRateLimit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
): Promise<RateLimitResult> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const { data: usage, error } = await supabase
    .from("ai_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  console.log("SELECT usage:", usage);
  console.log("SELECT error:", error);

  if (!usage) {
    const { data, error } = await supabase
      .from("ai_usage")
      .insert({
        user_id: userId,
        usage_date: today,
        request_count: 1,
        minute_window_start: now.toISOString(),
        minute_count: 1,
      })
      .select();

    console.log("INSERT DATA:", data);
    console.log("INSERT ERROR:", error);

    return { 
        allowed: true,
        remaining: DAILY_LIMIT - 1, 
      };
  }

  if (usage.request_count >= DAILY_LIMIT) {
    const resetAt = new Date();
    resetAt.setDate(resetAt.getDate() + 1);
    resetAt.setHours(0, 0, 0, 0);
    return { allowed: false, reason: "daily", resetAt };
  }

  const windowStart = usage.minute_window_start
    ? new Date(usage.minute_window_start)
    : null;
  const windowExpired =
    !windowStart || now.getTime() - windowStart.getTime() >= 60_000;

  let newWindowStart = windowStart ?? now;
  let newMinuteCount = usage.minute_count ?? 0;

  if (windowExpired) {
    newWindowStart = now;
    newMinuteCount = 1;
  } else {
    if (newMinuteCount >= PER_MINUTE_LIMIT) {
      const retryAfterMs = 60_000 - (now.getTime() - windowStart!.getTime());
      return {
        allowed: false,
        reason: "minute",
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }
    newMinuteCount += 1;
  }

  await supabase
    .from("ai_usage")
    .update({
      request_count: usage.request_count + 1,
      minute_window_start: newWindowStart.toISOString(),
      minute_count: newMinuteCount,
    })
    .eq("id", usage.id);

  return { 
      allowed: true,
      remaining: DAILY_LIMIT - (usage.request_count + 1), 
    };
}

async function callOpenRouter(
  model: string,
  apiKey: string,
  messages: any[],
  jsonMode = true,
) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "BrainForge AI",
    },

    body: JSON.stringify({
      model,

      max_tokens: 2048,

      ...(jsonMode && {
        response_format: {
          type: "json_object",
        },
      }),

      messages,
    }),
  });
}

function safeParseStructured(raw: string) {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (["quiz", "flashcards", "reviewer", "text"].includes(parsed.type)) {
      return parsed;
    }
  } catch {}

  return {
    type: "text",
    text: raw,
  };
}

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json();

    if (!userId) {
      return Response.json(
        {
          error: "User not authenticated",
        },
        {
          status: 401,
        },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "OPENROUTER_API_KEY missing",
        },
        {
          status: 500,
        },
      );
    }

    const supabase = getSupabaseAdmin();

    // CHECK + CONSUME RATE LIMIT (daily + per-minute)
    const rateLimit = await checkAndConsumeRateLimit(supabase, userId);

    if (!rateLimit.allowed) {
      if (rateLimit.reason === "daily") {
        return Response.json(
          {
            error: `🚫 Daily AI limit reached.

            Your limit will automatically reset tomorrow at 12:00 AM.

            See you tomorrow!`,
          },
          { status: 429 },
        );
      }

      // per-minute throttle
      return Response.json(
        {
          error: `⏳ Sending too fast. Please wait ${rateLimit.retryAfterSeconds}s and try again.`,
        },
        { status: 429 },
      );
    }

    let finalData: any = null;

    for (const model of MODELS) {
      console.log("Trying model:", model);

      let res = await callOpenRouter(
        model,
        apiKey,
        [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          ...messages,
        ],
        true,
      );

      let data = await res.json();

      if (res.ok) {
        finalData = data;
        break;
      }

      // retry without JSON mode

      console.log("JSON mode failed, retrying:", model);

      res = await callOpenRouter(
        model,
        apiKey,
        [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          ...messages,
        ],
        false,
      );

      data = await res.json();

      if (res.ok) {
        finalData = data;
        break;
      }

      console.log("Failed:", model, data.error?.message);
    }

    if (!finalData) {
      return Response.json(
        {
          error: "All AI providers are currently unavailable.",
        },
        {
          status: 429,
        },
      );
    }

    const output =
      finalData.choices?.[0]?.message?.content ??
      `{
"type":"text",
"text":"No response generated"
}`;

    return Response.json({
      structured: safeParseStructured(output),
      remaining: rateLimit.remaining,
    });
  } catch (error: any) {
    console.error("AI ROUTE ERROR:", error);

    return Response.json(
      {
        error: String(error?.message ?? error),
      },
      {
        status: 500,
      },
    );
  }
}
