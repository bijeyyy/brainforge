// app/api/generate-quiz/route.ts
//
// Setup needed:
//   npm install pdf-parse groq-sdk
//   Add GROQ_API_KEY to your .env.local
//
// This route accepts EITHER:
//   - a "file" field (PDF upload, original flow), or
//   - a "text" field (raw text, e.g. a Reviewer's already-extracted content)

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
// @ts-ignore
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'llama-3.3-70b-versatile'

const MAX_SOURCE_TEXT_CHARS = 40_000
const MAX_QUESTIONS = 20

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const rawText = formData.get('text') as string | null

    let text: string

    if (rawText && rawText.trim()) {
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
        { error: 'Could not read any usable text from that source (baka scanned image ito na walang OCR).' },
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
            'You are a multiple-choice quiz generator. Given source text, produce quiz questions that test ' +
            'the key facts, definitions, and concepts. Respond with ONLY a JSON object, no preamble, no markdown ' +
            'fences, in this exact shape: {"title":"short quiz title","questions":[{"prompt":"...",' +
            '"options":["...","...","...","..."],"correct_index":0,"explanation":"...","topic":"..."}]}. ' +
            'Each question must have exactly 4 options, and correct_index must be the 0-based index of the ' +
            'correct option. Keep "explanation" short (1-2 sentences) and "topic" a short label (e.g. a chapter ' +
            `or concept name). Generate at most ${MAX_QUESTIONS} questions.`,
        },
        { role: 'user', content: `Generate a quiz from this material:\n\n${text}` },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''

    let title: string
    let questions: any[]
    try {
      const obj = JSON.parse(raw)
      title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Generated Quiz'
      questions = Array.isArray(obj.questions) ? obj.questions : []
    } catch {
      return NextResponse.json(
        { error: 'The AI response could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    questions = questions
      .filter(
        (q: any) =>
          q &&
          typeof q.prompt === 'string' &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((o: any) => typeof o === 'string' && o.trim()) &&
          Number.isInteger(q.correct_index) &&
          q.correct_index >= 0 &&
          q.correct_index <= 3
      )
      .map((q: any) => ({
        prompt: q.prompt.trim(),
        options: q.options.map((o: string) => o.trim()),
        correct_index: q.correct_index,
        explanation: typeof q.explanation === 'string' ? q.explanation.trim() : null,
        topic: typeof q.topic === 'string' ? q.topic.trim() : null,
      }))
      .slice(0, MAX_QUESTIONS)

    if (!questions.length) {
      return NextResponse.json(
        { error: 'No usable questions could be generated from this source.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ title, questions })
  } catch (err: any) {
    console.error('generate-quiz error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Something went wrong generating the quiz.' },
      { status: 500 }
    )
  }
}