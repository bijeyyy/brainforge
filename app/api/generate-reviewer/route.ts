import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// ⚠️ Import the internal lib file directly — NOT `pdf-parse`'s index.js.
// The package's index.js has an `isDebugMode` check (`!module.parent`) that
// becomes true when bundled by webpack/Next.js, causing it to try to read a
// nonexistent test PDF file at import time and crash the whole module
// before your route code even runs (this is what caused the HTML 500 page).
import pdf from 'pdf-parse/lib/pdf-parse.js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { userId, storagePath, title } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: file, error: dlError } = await supabase.storage.from('pdfs').download(storagePath)
    if (dlError || !file) {
      console.error('generate-reviewer download error:', dlError, 'storagePath:', storagePath)
      return NextResponse.json({ error: `Could not read the uploaded file: ${dlError?.message ?? 'unknown'} (path: ${storagePath})` }, { status: 400 })
    }

    // Extract raw text from the PDF first — Groq models are text-only
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await pdf(buffer)
    const text = parsed.text.trim()

    if (!text || text.length < 20) {
      return NextResponse.json({ error: 'Could not extract readable text from this PDF (it may be scanned/image-based).' }, { status: 400 })
    }

    // Groq has smaller context limits — trim very long docs to be safe
    const trimmedText = text.slice(0, 30000)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `Create a study reviewer from the following document content, in Markdown format:
- Use clear ## section headers matching the document's structure
- **Bold** key terms and important facts
- Use bullet points for lists of concepts, dates, formulas, or definitions
- End with a "🎯 Key Pointers" section summarizing the 5-8 most important things to remember
- Keep it concise and exam-focused — this is for a student reviewing before a test
- Do not add a title/heading at the very top, start directly with the first section

DOCUMENT CONTENT:
${trimmedText}`,
        },
      ],
      max_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content ?? ''
    if (!content) {
      return NextResponse.json({ error: 'AI returned an empty response.' }, { status: 500 })
    }

    const { data, error } = await supabase.from('reviewers')
      .insert({ user_id: userId, title, content })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('generate-reviewer error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate reviewer.' }, { status: 500 })
  }
}