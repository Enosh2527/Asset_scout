# 🔍 Asset Scout — AI Director Suite

> Transform scripts into cinematic shot plans, asset maps, and production-ready direction.

Asset Scout is a high-performance research suite designed for video editors and directors. It uses Gemini AI and Pexels integration to scout high-quality B-roll, transparent PNGs, and overlays based on your script narrative.

## 🚀 Key Features
- **Parallel Asset Scouting**: Fetch 40+ assets in seconds using multi-threaded API calls.
- **Video Scrubber**: Preview B-roll motion directly in the dashboard on hover.
- **Ultra-Customization**: Full site rebranding (colors, titles, radii) via the Live Settings dashboard.
- **Smart Overlays**: Automatically identifies and scouts icons/stickers relevant to your script.
- **Bulk Export**: Bundle all your production assets into an organized ZIP file.

## ☁️ Deployment (Cloudflare Pages)
This project is pre-configured for Cloudflare Pages.
1. Connect your Git repository to Cloudflare.
2. Ensure `nodejs_compat` is enabled in compatibility flags.
3. Set `GEMINI_API_KEY` and `PEXELS_API_KEY` in environment variables.

## 🛠️ Tech Stack
- **Next.js 14** (App Router)
- **Google Gemini Pro** (Narrative Analysis)
- **Pexels API** (High-Res Assets)
- **Vanilla CSS** (Higgsfield AI Design System)

## 📦 Setup
```bash
npm install
npm run dev
```

---
Built with ⚡ by Asset Scout AI
