import { NextResponse } from 'next/server';
export const runtime = 'edge';
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDdRNa__DxWhOTbch5z2O1ez5CbDa2vpNk";

// Simple in-memory cache to avoid repeated calls (clears on server restart)
const cache = new Map();

export async function POST(request) {
  try {
    const body = await request.json();
    const { transcript, scriptType = 'YouTube Short', tone = 'Cinematic' } = body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
      return NextResponse.json({ error: 'A valid transcript (min 10 chars) is required.' }, { status: 400 });
    }

    const sanitized = transcript.trim().substring(0, 10000);
    const cacheKey = `${sanitized.substring(0, 100)}-${scriptType}-${tone}`;

    if (cache.has(cacheKey)) {
      return NextResponse.json(cache.get(cacheKey));
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `
You are a professional video director and post-production editor.
Script Type: ${scriptType}
Tone: ${tone}

Analyze the following script. Return structured JSON with:
1. A "summary" object with high-level editorial insights including:
   - thumbnailConcept, colorMood, editingStyle, editDifficulty, timelinePacing, accuracyScore
   - colorGrade: recommended LUT/color grade name (e.g., "Teal & Orange", "Bleach Bypass", "Warm Vintage")
   - sfxList: array of 5 suggested sound effects for the whole video
3. An "overlays" array with 10 specific overlay suggestions (icons, stickers, lower thirds, callouts) that directly relate to the script's key points.
2. An "items" array with exactly 40 visual assets (mix of B-roll and PNG images). Prioritize quantity — cover every sentence, emotion, object, and moment in the script.

For each item:
- "sentence": The exact sentence/phrase from the transcript.
- "visualDescription": A precise, detailed description of what the visual should look like.
- "searchQuery": A hyper-specific, long-tail search string. Include colors, materials, angle, lighting.
- "suggestedUsage": One of: hook, cutaway, emotional_beat, transition, proof, context.
- "estimatedTimecode": Estimate like "0:05", "0:12", etc.
- "assetType": Either "broll" or "image".
- "sfxSuggestion": A specific sound effect for this moment (e.g., "paper rustling", "crowd gasping").

Script:
${sanitized}
`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.OBJECT,
          properties: {
            thumbnailConcept: { type: Type.STRING },
            colorMood: { type: Type.STRING },
            colorGrade: { type: Type.STRING },
            editingStyle: { type: Type.STRING },
            editDifficulty: { type: Type.STRING },
            timelinePacing: { type: Type.STRING },
            accuracyScore: { type: Type.NUMBER },
            sfxList: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['thumbnailConcept','colorMood','colorGrade','editingStyle','editDifficulty','timelinePacing','accuracyScore','sfxList']
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sentence: { type: Type.STRING },
              visualDescription: { type: Type.STRING },
              searchQuery: { type: Type.STRING },
              suggestedUsage: { type: Type.STRING },
              estimatedTimecode: { type: Type.STRING },
              assetType: { type: Type.STRING },
              sfxSuggestion: { type: Type.STRING }
            },
            required: ['sentence','visualDescription','searchQuery','suggestedUsage','estimatedTimecode','assetType','sfxSuggestion']
          }
        },
        overlays: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              searchQuery: { type: Type.STRING },
              visualDescription: { type: Type.STRING },
              context: { type: Type.STRING }
            },
            required: ['type', 'searchQuery', 'visualDescription', 'context']
          }
        }
      },
      required: ['summary', 'items', 'overlays']
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let result;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: schema }
      });
      clearTimeout(timeout);
      result = JSON.parse(response.text);
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }

    cache.set(cacheKey, result);
    // Keep cache small
    if (cache.size > 20) cache.delete(cache.keys().next().value);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Analyze Error:', error);
    const msg = error.message || 'Internal Server Error';
    if (msg.includes('quota') || msg.includes('429')) {
      return NextResponse.json({ error: 'API quota exceeded. Please try again in a minute.' }, { status: 429 });
    }
    if (msg.includes('abort') || msg.includes('timeout')) {
      return NextResponse.json({ error: 'Request timed out. Try a shorter script.' }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
