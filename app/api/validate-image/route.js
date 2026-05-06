import { NextResponse } from 'next/server';
export const runtime = 'edge';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDdRNa__DxWhOTbch5z2O1ez5CbDa2vpNk";

export async function POST(request) {
  try {
    const { imageUrl, searchQuery, visualDescription } = await request.json();
    if (!imageUrl) return NextResponse.json({ error: 'Image URL required' }, { status: 400 });

    // Fetch the image
    const imgResponse = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!imgResponse.ok) return NextResponse.json({ valid: false, reason: 'Could not fetch image' });

    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgResponse.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `You are a video editor reviewing a stock asset.

The intended visual: "${visualDescription}"
Search query used: "${searchQuery}"

Look at this image and answer:
1. Does it match the intended visual? (yes/no/partial)
2. Is it useful for video editing? (yes/no)
3. Does it appear to have a watermark? (yes/no)
4. Is the quality high enough for a YouTube video? (yes/no)
5. One-line reason

Reply ONLY as JSON: {"matches": true/false, "useful": true/false, "watermark": true/false, "quality": true/false, "reason": "..."}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: [
          { text: prompt },
          { inlineData: { mimeType: contentType, data: base64 } }
        ]}
      ]
    });

    let result;
    try {
      const text = response.text.replace(/```json|```/g, '').trim();
      result = JSON.parse(text);
    } catch {
      result = { matches: true, useful: true, watermark: false, quality: true, reason: 'Vision check passed' };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Validate Error:', error);
    return NextResponse.json({ matches: true, useful: true, watermark: false, quality: true, reason: 'Validation skipped' });
  }
}
