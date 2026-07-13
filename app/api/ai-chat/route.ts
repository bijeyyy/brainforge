// AI provider: GROQ (free tier) — https://console.groq.com/keys
// .env.local:   GROQ_API_KEY=gsk_your-key-here
// If the model is ever retired, pick a current one at https://console.groq.com/docs/models

// ✏️ EDIT THIS BLOCK to update your personal info — the AI will use it
// whenever someone asks who made/created/developed the app.
const CREATOR_INFO = `
About the creator of BrainForge AI:
- Name: Bob John Lapinig
- Age: 19 years old
- Location: Muntinlupa City, Philippines
- Role: Developer and creator of BrainForge AI
- Tech stack used to build this app: Next.js, React, TypeScript, TailwindCSS, Supabase (auth + database), and Groq for AI
- Skills: Front-End Web Development, UI/UX design, and AI integration
`

const SYSTEM_PROMPT =
  'You are BrainForge AI, a friendly study assistant for students and board-exam reviewees. ' +
  'Explain clearly and concisely. Keep answers focused on studying.\n\n' +
  'If (and only if) the user asks who created, made, or developed this app or who the creator/developer is, ' +
  'answer proudly using this information:\n' + CREATOR_INFO + '\n\n' +
  'RESPONSE FORMAT — this is critical: you must ALWAYS reply with a single valid JSON object, ' +
  'no markdown code fences, no preamble, no text outside the JSON. Pick exactly ONE of these shapes:\n\n' +
  '{"type":"quiz","title":string,"duration_minutes":number,"passing_percent":number,"questions":[{"prompt":string,"options":[string,string,string,string],"correct_index":number,"explanation":string,"topic":string}]}\n\n' +
  '{"type":"flashcards","title":string,"cards":[{"front":string,"back":string}]}\n\n' +
  '{"type":"reviewer","title":string,"content":string}\n\n' +
  '{"type":"text","text":string}\n\n' +
  'Use "quiz" only when explicitly asked for a quiz, test, or exam. Use "flashcards" only when explicitly asked for flashcards. ' +
  'Use "reviewer" for outlines, summaries, or study guides. Use "text" for everything else — explanations, mnemonics, ' +
  'the creator question, or plain chat. The "text" field/content can use markdown formatting freely. Output raw JSON only, nothing else.'

const MODEL = 'llama-3.3-70b-versatile'

function safeParseStructured(raw: string) {
  try {
    const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (['quiz', 'flashcards', 'reviewer', 'text'].includes(parsed?.type)) return parsed
  } catch {}
  // Model failed to return valid JSON — fall back to plain text so nothing breaks
  return { type: 'text', text: raw }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'GROQ_API_KEY is not set in .env.local' }, { status: 500 })
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        response_format: { type: 'json_object' }, // pinipilit ni Groq na JSON talaga yung output
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return Response.json({ error: data.error?.message ?? 'Groq request failed' }, { status: 500 })
    }

    const text: string = data.choices?.[0]?.message?.content ?? '{"type":"text","text":"Sorry, I could not generate a response."}'
    return Response.json({ structured: safeParseStructured(text) })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}