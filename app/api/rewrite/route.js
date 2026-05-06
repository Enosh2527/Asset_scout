import { NextResponse } from 'next/server';

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "PLACEHOLDER_KEY";

export async function POST(request) {
  try {
    const { transcript, goal = 'cinematic visuals', scriptType = 'YouTube Short' } = await request.json();
    if (!transcript) return NextResponse.json({ error: 'Transcript required' }, { status: 400 });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `You are a professional video scriptwriter.
Rewrite the following ${scriptType} script to maximize visual storytelling. 
Goal: ${goal}
Rules:
- Keep the same core message and facts
- Make every sentence suggest a strong visual
- Use vivid, concrete language (avoid abstract words)
- Keep similar length
- Do NOT add stage directions or [brackets]

Original Script:
${transcript.substring(0, 5000)}

Return ONLY the rewritten script text, nothing else.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return NextResponse.json({ rewritten: response.text });
  } catch (error) {
    console.error('Rewrite Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
