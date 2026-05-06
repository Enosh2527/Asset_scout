import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'YouTube URL required' }, { status: 400 });

    // Extract video ID from various YouTube URL formats
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });

    const videoId = match[1];
    // Attempt to fetch transcript with English as preference
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    
    if (!transcript || transcript.length === 0) {
      throw new Error('Transcript is empty');
    }

    const text = transcript.map(t => t.text).join(' ').replace(/&amp;#39;/g, "'").replace(/&quot;/g, '"');

    return NextResponse.json({ transcript: text, lines: transcript.length });
  } catch (error) {
    console.error('Transcript Error:', error);
    return NextResponse.json({ error: 'Could not fetch transcript. Video may have captions disabled.' }, { status: 500 });
  }
}
