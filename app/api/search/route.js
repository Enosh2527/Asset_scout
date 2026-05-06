import { NextResponse } from 'next/server';
export const runtime = 'edge';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "LscjUvYmR4WwB4WwB4WwB4WwB4WwB4WwB4WwB4WwB4WwB4Ww"; // Use process.env in production

export async function POST(request) {
  try {
    const { query, assetType } = await request.json();
    if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });

    const isVideo = assetType === 'video';
    const endpoint = isVideo 
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15`;

    const res = await fetch(endpoint, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });

    if (!res.ok) throw new Error('Pexels API failed');
    const data = await res.json();

    if (isVideo) {
      const videos = data.videos || [];
      if (videos.length === 0) return NextResponse.json({ error: 'No videos found' });
      
      const v = videos[0];
      // Get the highest quality video file
      const file = v.video_files.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];

      return NextResponse.json({
        videoUrl: file.link,
        videoPreview: v.image,
        videoDuration: v.duration,
        imageWidth: v.width,
        imageHeight: v.height
      });
    } else {
      const photos = data.photos || [];
      if (photos.length === 0) return NextResponse.json({ error: 'No images found' });

      const p = photos[0];
      return NextResponse.json({
        imageUrl: p.src.large2x,
        imageThumb: p.src.medium,
        imageWidth: p.width,
        imageHeight: p.height
      });
    }
  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
