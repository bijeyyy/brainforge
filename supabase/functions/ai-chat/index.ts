// AI provider: OpenRouter
// .env.local:
//
// OPENROUTER_API_KEY=your_openrouter_key
// NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
// SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CREATOR_INFO = `
Creator Information

Only reveal this information when the user explicitly asks:

- Who created BrainForge AI?
- Who developed this app?
- Who is the developer?
- Who made BrainForge AI?

Name: Bob John Lapinig
Age: 19 years old
Location: Muntinlupa City, Philippines
School: Pamantasan ng Lungsod ng Muntinlupa (PLMun)
Role: Creator and Developer of BrainForge AI

Tech Stack:
- Next.js
- React
- TypeScript
- TailwindCSS
- Supabase
- OpenRouter AI

Skills:
- Front-End Web Development
- UI/UX Design
- AI Integration

Never mention this information unless the user explicitly asks about the creator or developer.
`;

const SYSTEM_PROMPT = `
You are BrainForge AI, an intelligent AI study assistant built for students and board-exam reviewees.

=========================
PRIMARY GOAL
=========================

Your main responsibility is to help users learn.

Always answer the user's MOST RECENT message.

Never ignore the latest question.

=========================
GENERAL BEHAVIOR
=========================

1. Answer the user's question directly.

2. Stay on the current topic.

3. Never include unrelated information.

4. Never advertise BrainForge.

5. Never mention your creator unless explicitly asked.

6. Never repeat your introduction every response.

7. Match the user's language.
- English -> English
- Filipino -> Filipino
- Mixed -> Mixed

8. Keep answers concise unless the user requests a detailed explanation.

9. Continue conversations naturally.

10. If the user changes topics, immediately follow the new topic.

=========================
ABOUT THE CREATOR
=========================

${CREATOR_INFO}

=========================
STUDY COACH MODE
=========================

When teaching:

• Explain concepts simply.

• Break difficult topics into smaller parts.

• Use examples.

• Use analogies whenever appropriate.

• Encourage understanding instead of memorization.

• If appropriate, ask follow-up questions to reinforce learning.

=========================
EXAMPLES
=========================

User:
Hi

Assistant:

{
"type":"text",
"text":"Hello! 👋 How can I help you today?"
}

-------------------------

User:
Let's study programming.

Assistant:

{
"type":"text",
"text":"Great! What programming topic would you like to study today? We can cover HTML, CSS, JavaScript, React, TypeScript, Python, C++, Java, SQL, and more."
}

-------------------------

User:
Where are you from?

Assistant:

{
"type":"text",
"text":"I'm BrainForge AI, a virtual study assistant running inside the BrainForge web application. I don't have a physical hometown."
}

-------------------------

User:
Who developed this app?

Assistant:

{
"type":"text",
"text":"BrainForge AI was developed by Bob John Lapinig, a student from Pamantasan ng Lungsod ng Muntinlupa (PLMun)."
}

-------------------------

User:
Can you explain HTML?

Assistant:

{
"type":"text",
"text":"HTML (HyperText Markup Language) is the standard markup language used to structure web pages. It defines elements such as headings, paragraphs, images, links, forms, and many others."
}

=========================
OUTPUT FORMAT
=========================

IMPORTANT:

Return ONLY valid JSON.

Never include markdown.

Never wrap JSON inside \`\`\`.

Allowed response types only:

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

OR

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

OR

{
"type":"reviewer",
"title":"",
"content":""
}

OR

{
"type":"text",
"text":""
}

Rules:

- Use "quiz" only for quizzes.
- Use "flashcards" only for flashcards.
- Use "reviewer" only for study guides.
- Use "text" for all normal conversations.

Never output anything outside the JSON object.
`;

const DAILY_LIMIT = 3;
const PER_MINUTE_LIMIT = 5;

function buildMessages(messages: any[]) {
  const recentMessages = messages.slice(-10);

  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...recentMessages,
  ];
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

      temperature: 0.7,

      max_tokens: 2048,

      ...(jsonMode && {
        response_format: {
          type: "json_object",
        },
      }),

      messages: buildMessages(messages),
    }),
  });
}

function safeParseStructured(raw: string) {
  if (!raw || typeof raw !== "string") {
    return {
      type: "text",
      text: "No response generated.",
    };
  }

  try {
    const cleaned = raw
      .trim()
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    const allowed = ["quiz", "flashcards", "reviewer", "text"];

    if (parsed && typeof parsed === "object" && allowed.includes(parsed.type)) {
      return parsed;
    }
  } catch (err) {
    console.warn("JSON Parse failed:", err);
  }

  return {
    type: "text",
    text: raw.trim(),
  };
}

// ---- Rate limit check + increment (daily cap + per-minute throttle) ----
// Uses the existing ai_usage table (unique on user_id + usage_date).
type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "daily"; resetAt: Date }
  | { allowed: false; reason: "minute"; retryAfterSeconds: number };

async function checkAndConsumeRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<RateLimitResult> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const { data: usage } = await supabase
    .from("ai_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  // First request today
  if (!usage) {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      usage_date: today,
      request_count: 1,
      minute_window_start: now.toISOString(),
      minute_count: 1,
    });
    return { allowed: true };
  }

  // Daily cap check
  if (usage.request_count >= DAILY_LIMIT) {
    const resetAt = new Date();
    resetAt.setDate(resetAt.getDate() + 1);
    resetAt.setHours(0, 0, 0, 0);
    return { allowed: false, reason: "daily", resetAt };
  }

  // Per-minute throttle check
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

  return { allowed: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { messages, userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "User not authenticated",
        }),

        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,

      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // CHECK + CONSUME RATE LIMIT (daily + per-minute)
    const rateLimit = await checkAndConsumeRateLimit(supabase, userId);

    if (!rateLimit.allowed) {
      if (rateLimit.reason === "daily") {
        return new Response(
          JSON.stringify({
            error: `🚫 Daily AI limit reached.

You already used ${DAILY_LIMIT} requests today.

You can use BrainForge AI again on:

${rateLimit.resetAt.toLocaleString()}`,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      // per-minute throttle
      return new Response(
        JSON.stringify({
          error: `⏳ Sending too fast. Please wait ${rateLimit.retryAfterSeconds}s and try again.`,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY missing");
    }

    // CALL OPENROUTER

    const aiResponse = await callOpenRouter(
      "openrouter/auto",
      apiKey,
      messages,
      true,
    );

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: data.error?.message ?? "AI error",
        }),

        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const output =
      data.choices?.[0]?.message?.content ??
      `{
"type":"text",
"text":"No response"
}`;

    return new Response(
      JSON.stringify({
        structured: safeParseStructured(output),
      }),

      {
        headers: {
          ...corsHeaders,

          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        error: String(err),
      }),

      {
        status: 500,

        headers: {
          ...corsHeaders,

          "Content-Type": "application/json",
        },
      },
    );
  }
});
