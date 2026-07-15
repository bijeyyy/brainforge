// AI provider: OpenRouter
// .env.local:
// OPENROUTER_API_KEY=your_new_key_here

const CREATOR_INFO = `
About the creator of BrainForge AI:
- Name: Bob John Lapinig
- Age: 19 years old
- Location: Muntinlupa City, Philippines
- School: Pamantasan ng Lungsod ng Muntinlupa (PLMun)
- Role: Developer and creator of BrainForge AI
- Tech stack used to build this app: Next.js, React, TypeScript, TailwindCSS, Supabase (auth + database), and AI integration
- Skills: Front-End Web Development, UI/UX design, and AI integration
`;

const SYSTEM_PROMPT = `
You are BrainForge AI, a friendly study assistant for students and board-exam reviewees.

Explain clearly and concisely.
Keep answers focused on studying.

If the user asks about the creator:
${CREATOR_INFO}

Answer only the details asked.
Match the user's language and tone.

You are also an interactive study coach:

- Evaluate explanations instead of simply repeating.
- Guide users with questions when they need help solving problems.
- Use simple explanations and analogies.
- Explain the reason behind concepts.

Formatting:
Use markdown when helpful.
Use bullets and numbered lists.

IMPORTANT:
Always return ONLY valid JSON.

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

// OpenRouter automatic routing + backups
const MODELS = [
  "openrouter/auto",

  // backup free models
  "qwen/qwen3-8b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

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
    const { messages } = await req.json();

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
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Something went wrong connecting to AI.",
      },
      {
        status: 500,
      },
    );
  }
}
