// app/api/generate-flashcards/route.ts
//
// Setup needed:
//   npm install pdf-parse groq-sdk
//   Add GROQ_API_KEY to your .env.local (never expose it to the client)
//
// This route accepts EITHER:
//   - a "file" field (PDF upload, original flow), or
//   - a "text" field (raw text, e.g. a Reviewer's already-extracted content)
//
// This route is intentionally simple (no auth/rate limiting) — add checks
// appropriate for your app (e.g. verify the Supabase session) before shipping.

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
// @ts-ignore - pdf-parse has no bundled types
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs' // pdf-parse needs Node, not the edge runtime

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Fast + strong at following formatting instructions. Swap for another
// Groq-hosted model if you prefer (e.g. 'llama-3.1-8b-instant' for speed,
// or check console.groq.com/docs/models for the current list).
const MODEL = 'llama-3.3-70b-versatile'

const MAX_SOURCE_TEXT_CHARS = 40_000 // keep prompt size sane for large sources
const MAX_CARDS = 40

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const rawText = formData.get('text') as string | null

    let text: string

    if (rawText && rawText.trim()) {
      // Coming from a Reviewer's content — already plain text, no parsing needed.
      text = rawText.trim().slice(0, MAX_SOURCE_TEXT_CHARS)
    } else if (file) {
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const parsed = await pdfParse(buffer)
      text = parsed.text.trim().slice(0, MAX_SOURCE_TEXT_CHARS)
    } else {
      return NextResponse.json({ error: 'No file or text was provided.' }, { status: 400 })
    }

    if (!text) {
      return NextResponse.json(
        { error: 'Could not read any usable text from that source (it may be a scanned image without OCR).' },
        { status: 422 }
      )
    }

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' }, // Groq/OpenAI-style forced JSON
      messages: [
        {
          role: 'system',
          content:
            'You are a study-flashcard generator. Given source text, produce concise question/answer ' +
            'flashcards that test the key facts, definitions, and concepts. ' +
            'Respond with ONLY a JSON object, no preamble, no markdown fences, in this exact shape: ' +
            '{"cards":[{"front":"...","back":"..."}]}. ' +
            `Generate at most ${MAX_CARDS} cards. Keep each "front" a short question or term, ` +
            'and each "back" a short, precise answer (1-2 sentences max).',
        },
        { role: 'user', content: `Generate flashcards from this material:\n\n${text}` },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''

    let cards: { front: string; back: string }[]
    try {
      const obj = JSON.parse(raw)
      cards = Array.isArray(obj) ? obj : obj.cards
    } catch {
      return NextResponse.json(
        { error: 'The AI response could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    cards = (cards ?? [])
      .filter((c: any) => c && typeof c.front === 'string' && typeof c.back === 'string')
      .map((c: any) => ({ front: c.front.trim(), back: c.back.trim() }))
      .filter((c: any) => c.front && c.back)
      .slice(0, MAX_CARDS)

    if (!cards.length) {
      return NextResponse.json(
        { error: 'No usable flashcards could be generated from this source.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ cards })
  } catch (err: any) {
    console.error('generate-flashcards error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Something went wrong generating flashcards.' },
      { status: 500 }
    )
  }
}