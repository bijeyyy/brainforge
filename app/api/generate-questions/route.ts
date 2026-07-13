// app/api/generate-questions/route.ts
//
// Setup: npm install pdf-parse groq-sdk (same as generate-flashcards)
// Add GROQ_API_KEY sa .env.local

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
// @ts-ignore - pdf-parse has no bundled types
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'llama-3.3-70b-versatile'

const MAX_PDF_TEXT_CHARS = 40_000
const MAX_QUESTIONS = 40

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await pdfParse(buffer)
    const text = parsed.text.trim().slice(0, MAX_PDF_TEXT_CHARS)

    if (!text) {
      return NextResponse.json(
        { error: 'Could not read any text from that PDF (it may be a scanned image without OCR).' },
        { status: 422 }
      )
    }

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an exam question generator. Given source text, produce multiple-choice questions ' +
            'that test the key facts, definitions, and concepts. ' +
            'Respond with ONLY a JSON object, no preamble, no markdown fences, in this exact shape: ' +
            '{"questions":[{"prompt":"...","options":["...","...","...","..."],"correct_index":0,"topic":"..."}]}. ' +
            'Each question must have exactly 4 options. "correct_index" is the 0-based index of the correct option. ' +
            '"topic" is a short 1-3 word category label for grouping (e.g. "Taxation", "Ethics"). ' +
            `Generate at most ${MAX_QUESTIONS} questions. Keep "prompt" clear and unambiguous, ` +
            'and make sure only one option is clearly correct.',
        },
        { role: 'user', content: `Generate exam questions from this material:\n\n${text}` },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''

    let questions: { prompt: string; options: string[]; correct_index: number; topic?: string }[]
    try {
      const obj = JSON.parse(raw)
      questions = Array.isArray(obj) ? obj : obj.questions
    } catch {
      return NextResponse.json(
        { error: 'The AI response could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    questions = (questions ?? [])
      .filter(
        (q: any) =>
          q &&
          typeof q.prompt === 'string' &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((o: any) => typeof o === 'string' && o.trim()) &&
          Number.isInteger(q.correct_index) &&
          q.correct_index >= 0 &&
          q.correct_index < 4
      )
      .map((q: any) => ({
        prompt: q.prompt.trim(),
        options: q.options.map((o: string) => o.trim()),
        correct_index: q.correct_index,
        topic: typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : 'General',
      }))
      .slice(0, MAX_QUESTIONS)

    if (!questions.length) {
      return NextResponse.json(
        { error: 'No usable questions could be generated from this PDF.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ questions })
  } catch (err: any) {
    console.error('generate-questions error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Something went wrong generating questions.' },
      { status: 500 }
    )
  }
}