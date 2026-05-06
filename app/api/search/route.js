import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';
import google from 'googlethis';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

async function searchPexels(query) {
  if (!PEXELS_API_KEY) return null;
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const data = await res.json();
    if (data.photos && data.photos.length > 0) {
      return {
        url: data.photos[0].src.large,
        source: 'pexels'
      };
    }
  } catch (e) {
    console.error('Pexels error:', e);
  }
  return null;
}

function getConfidence(title = '', description = '', visualDescription = '') {
  const combined = (title + ' ' + description).toLowerCase();
  const terms = visualDescription.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  let hits = 0;
  terms.forEach(t => { if (combined.includes(t)) hits++; });
  const score = terms.length > 0 ? Math.round((hits / terms.length) * 100) : 50;
  return Math.min(100, Math.max(10, score));
}

export async function POST(request) {
  try {
    const { query, visualDescription = '', assetType = 'broll' } = await request.json();

    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    let videoUrl = null, videoTitle = null, videoPreview = null, videoId = null;
    let imageUrl = null, imageWidth = 0, imageHeight = 0;
    let confidence = 0;

    await Promise.allSettled([
      // YouTube search
      (async () => {
        try {
          const ytRes = await ytSearch(query + ' 4k cinematic');
          if (ytRes?.videos?.length > 0) {
            const best = ytRes.videos[0];
            videoUrl = best.url;
            videoTitle = best.title;
            videoPreview = best.thumbnail;
            videoId = best.videoId;
            confidence = Math.max(confidence, getConfidence(best.title, best.description || '', visualDescription));
          }
        } catch (e) { console.error('YT error:', e.message); }
      })(),

      // Pexels / Google search
      (async () => {
        try {
          // Try Pexels first for reliability
          const pexelsRes = await searchPexels(query);
          if (pexelsRes) {
            imageUrl = pexelsRes.url;
            imageWidth = pexelsRes.width || 1920;
            imageHeight = pexelsRes.height || 1080;
            confidence = Math.max(confidence, 80); 
          } else {
            // Fallback to Google
            const imgQuery = assetType === 'image' ? `${query} transparent background png` : `${query} high resolution`;
            const images = await google.image(imgQuery, { safe: false });
            if (images?.length > 0) {
              imageUrl = images[0].url;
              imageWidth = images[0].width || 0;
              imageHeight = images[0].height || 0;
              confidence = Math.max(confidence, getConfidence(images[0].origin?.title || '', '', visualDescription));
            }
          }
        } catch (e) { console.error('Image error:', e.message); }
      })()
    ]);

    return NextResponse.json({
      videoUrl, videoTitle, videoPreview, videoId,
      imageUrl, imageWidth, imageHeight,
      confidence,
      validationStatus: confidence >= 70 ? 'Perfect Match' : confidence >= 40 ? 'Good Match' : 'Weak Match'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
