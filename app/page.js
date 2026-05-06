'use client';
import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';

const SCRIPT_TYPES = ['YouTube Short', 'Reel', 'Documentary', 'Explainer', 'Podcast', 'News', 'Education'];
const TONES = ['Cinematic', 'Viral', 'Clean', 'Emotional', 'Dark', 'Minimal'];
const OVERLAY_PRESETS = {
  'Green Screen': ['explosion green screen', 'confetti green screen', 'fire green screen', 'smoke green screen'],
  'Icons': ['notification bell icon', 'checkmark icon', 'warning icon', 'play icon'],
  'Particles': ['bokeh particles', 'dust particles', 'light leaks'],
  'Mockups': ['iphone frame', 'laptop frame', 'browser mockup']
};

function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 3000 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ 
          background: t.type === 'error' ? '#ef4444' : t.type === 'success' ? 'var(--app-accent)' : '#1c1e20', 
          color: t.type === 'success' ? '#000' : '#f7f7f8', 
          padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid var(--color-border-muted)'
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [scriptType, setScriptType] = useState('YouTube Short');
  const [tone, setTone] = useState('Cinematic');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('broll');
  const [toasts, setToasts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [visionResults, setVisionResults] = useState({});
  const [overlayResults, setOverlayResults] = useState([]);
  const [scriptOverlays, setScriptOverlays] = useState([]);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayCat, setOverlayCat] = useState('Script Matches');
  const [hoveredId, setHoveredId] = useState(null);
  const [analysisStep, setAnalysisStep] = useState('');
  const [progress, setProgress] = useState(0);

  // --- USER SETTINGS ---
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    fontSize: 14,
    batchSize: 5,
    previewSize: 280,
    onlyHD: false,
    parallel: true,
    themeColor: '#d1fe17',
    siteTitle: 'SCOUT PLATFORM',
    sidebarTitle: 'HIGGSFIELD',
    heroHeading: 'Video Infrastructure',
    heroSubheading: 'Analyze script metrics and scout visual assets at scale.',
    borderRadius: 14,
    sidebarWidth: 280
  });

  const taRef = useRef(null);

  useEffect(() => {
    const h = localStorage.getItem('scout_h'); if (h) setHistory(JSON.parse(h));
    const s = localStorage.getItem('scout_s'); if (s) setSettings(prev => ({ ...prev, ...JSON.parse(s) }));
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = taRef.current.scrollHeight + 'px';
    }
  }, [transcript]);

  useEffect(() => {
    localStorage.setItem('scout_s', JSON.stringify(settings));
    document.documentElement.style.setProperty('--app-font-size', `${settings.fontSize}px`);
    document.documentElement.style.setProperty('--app-accent', settings.themeColor);
    document.documentElement.style.setProperty('--app-card-radius', `${settings.borderRadius}px`);
  }, [settings]);

  const addToast = (msg, type = 'info') => {
    const id = Date.now(); setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const handleDownload = async (url, filename) => {
    try {
      const r = await fetch(`/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`);
      const b = await r.blob(); const u = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u);
    } catch { window.open(url, '_blank'); }
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) return addToast('Paste a script!', 'warning');
    setLoading(true); setResults([]); setDone(false); setProgress(0);
    const steps = ['Mapping Narrative Structure...', 'Detecting Visual Context...', 'Scouting High-Res Assets...', 'Optimizing Production Flow...'];
    
    try {
      setAnalysisStep(steps[0]);
      const ar = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, scriptType, tone }) });
      const data = await ar.json(); setSummary(data.summary);
      setProgress(25); setAnalysisStep(steps[1]);

      const initialOvs = await Promise.all((data.overlays || []).slice(0, 8).map(async (o) => {
        const sr = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: o.searchQuery, assetType: 'image' }) });
        return { ...o, ...(await sr.json()) };
      }));
      setScriptOverlays(initialOvs); setOverlayResults(initialOvs); setOverlayCat('Script Matches');
      setProgress(50); setAnalysisStep(steps[2]);

      const nr = [];
      for (let i = 0; i < data.items.length; i += settings.batchSize) {
        setAnalysisStep(`Scouting Batch ${Math.floor(i/settings.batchSize) + 1}...`);
        const batch = data.items.slice(i, i + settings.batchSize);
        const res = await Promise.all(batch.map(async (item, idx) => {
          const sr = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: item.searchQuery, visualDescription: item.visualDescription, assetType: item.assetType }) });
          return { id: i + idx, ...item, ...(await sr.json()) };
        }));
        nr.push(...res); setResults([...nr]);
        setProgress(50 + Math.floor((i / data.items.length) * 50));
      }
      setAnalysisStep(steps[3]); setDone(true); addToast('Analysis Complete', 'success');
      const nh = [{ id: Date.now(), text: transcript.substring(0, 40), fullText: transcript, results: nr, summary: data.summary, overlays: initialOvs }, ...history.slice(0, 19)];
      setHistory(nh); localStorage.setItem('scout_h', JSON.stringify(nh));
    } catch (e) { addToast('Failed', 'error'); } finally { setLoading(false); setAnalysisStep(''); }
  };

  const loadOverlays = async (cat) => {
    setOverlayCat(cat); setOverlayLoading(true); setOverlayResults([]);
    const queries = OVERLAY_PRESETS[cat] || [];
    const res = await Promise.all(queries.map(async (q) => {
      const r = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, assetType: 'image' }) });
      return { q, ...(await r.json()) };
    }));
    setOverlayResults(res); setOverlayLoading(false);
  };

  const downloadAllZip = async (onlySelected = false) => {
    const items = results.filter(r => r.imageUrl && (!onlySelected || selectedIds.has(r.id)));
    if (!items.length) return addToast('No items to ZIP', 'warning');
    addToast(`Building ZIP with ${items.length} assets...`, 'info');
    const zip = new JSZip();
    for (const [i, item] of items.entries()) {
      try {
        const r = await fetch(`/api/download?url=${encodeURIComponent(item.imageUrl)}&filename=img.png`);
        if (r.ok) zip.file(`${i+1}.png`, await r.blob());
      } catch {}
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = 'scout-infrastructure.zip'; a.click();
    addToast('ZIP Downloaded', 'success');
  };

  return (
    <div className="layout">
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} onClick={e => e.stopPropagation()}>
            <div>
              <h3 style={{ marginBottom: '16px', color: 'var(--app-accent)' }}>Branding & Content</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '10px' }}>SITE TITLE <input className="input" style={{ padding: '8px' }} value={settings.siteTitle} onChange={e => setSettings({...settings, siteTitle: e.target.value})} /></label>
                <label style={{ fontSize: '10px' }}>SIDEBAR TITLE <input className="input" style={{ padding: '8px' }} value={settings.sidebarTitle} onChange={e => setSettings({...settings, sidebarTitle: e.target.value})} /></label>
                <label style={{ fontSize: '10px' }}>HERO HEADING <input className="input" style={{ padding: '8px' }} value={settings.heroHeading} onChange={e => setSettings({...settings, heroHeading: e.target.value})} /></label>
                <label style={{ fontSize: '10px' }}>HERO SUBHEADING <textarea className="input" style={{ padding: '8px', minHeight: '60px' }} value={settings.heroSubheading} onChange={e => setSettings({...settings, heroSubheading: e.target.value})} /></label>
              </div>
            </div>
            <div>
              <h3 style={{ marginBottom: '16px', color: 'var(--app-accent)' }}>Visuals & Pipeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '10px' }}>ACCENT COLOR <input type="color" value={settings.themeColor} onChange={e => setSettings({...settings, themeColor: e.target.value})} style={{ width: '100%', height: '30px', border: 'none', background: 'none' }} /></label>
                <label style={{ fontSize: '10px' }}>FONT SIZE ({settings.fontSize}px) <input type="range" min="10" max="24" value={settings.fontSize} onChange={e => setSettings({...settings, fontSize: parseInt(e.target.value)})} style={{ width: '100%' }} /></label>
                <label style={{ fontSize: '10px' }}>CARD RADIUS ({settings.borderRadius}px) <input type="range" min="0" max="40" value={settings.borderRadius} onChange={e => setSettings({...settings, borderRadius: parseInt(e.target.value)})} style={{ width: '100%' }} /></label>
                <label style={{ fontSize: '10px' }}>PREVIEW SCALE ({settings.previewSize}px) <input type="range" min="150" max="500" value={settings.previewSize} onChange={e => setSettings({...settings, previewSize: parseInt(e.target.value)})} style={{ width: '100%' }} /></label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowSettings(false)}>Apply</button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '10px' }} onClick={() => {
                    setSettings({ fontSize: 14, batchSize: 5, previewSize: 280, onlyHD: false, parallel: true, themeColor: '#d1fe17', siteTitle: 'SCOUT PLATFORM', sidebarTitle: 'HIGGSFIELD', heroHeading: 'Video Infrastructure', heroSubheading: 'Analyze script metrics and scout visual assets at scale.', borderRadius: 14 });
                  }}>Reset</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div style={{ padding: '24px', borderBottom: '1px solid var(--color-border-muted)' }}>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>{settings.sidebarTitle}</div>
          <div style={{ fontSize: '9px', color: 'var(--color-text-primary)', marginTop: '4px', letterSpacing: '0.1em' }}>DIRECTOR INFRASTRUCTURE</div>
        </div>
        <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
          {history.map(h => (
            <div key={h.id} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '11px', marginBottom: '4px', textTransform: 'none' }} onClick={() => { setTranscript(h.fullText); setResults(h.results); setSummary(h.summary); setDone(true); setScriptOverlays(h.overlays || []); }}>
              {h.text}...
            </div>
          ))}
        </div>
        <div style={{ padding: '24px', borderTop: '1px solid var(--color-border-muted)' }}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowSettings(true)}>⚙ SYSTEM SETTINGS</button>
        </div>
      </aside>

      <main className="main">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <header style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: '42px', lineHeight: 1 }}>{settings.siteTitle}</h1>
              <p style={{ color: 'var(--color-text-primary)', marginTop: '8px', fontSize: '14px' }}>{settings.heroSubheading}</p>
            </div>
          </header>

          <section className="card" style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <select className="input" style={{ width: '160px' }} value={scriptType} onChange={e => setScriptType(e.target.value)}>{SCRIPT_TYPES.map(s => <option key={s}>{s}</option>)}</select>
              <input className="input" placeholder="SOURCE YOUTUBE URL..." value={ytUrl} onChange={e => setYtUrl(e.target.value)} />
              <button className="btn btn-secondary" onClick={async () => { setYtLoading(true); try { const r = await fetch('/api/transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ytUrl }) }); const d = await r.json(); setTranscript(d.transcript); } finally { setYtLoading(false); } }}>{ytLoading ? '...' : 'PULL'}</button>
            </div>
            <textarea ref={taRef} className="textarea" placeholder="INPUT SCRIPT DATA..." value={transcript} onChange={e => setTranscript(e.target.value)} style={{ minHeight: '140px', marginBottom: '20px', position: 'relative' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className={`btn btn-primary ${loading ? 'pulse-button' : ''}`} onClick={handleGenerate} disabled={loading}>
                {loading ? '⚡ EXECUTING SCAN...' : '⚡ RUN INFRA SCAN'}
              </button>
              <button className="btn btn-secondary" onClick={() => setTranscript('')}>CLEAR</button>
            </div>
            {loading && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px', color: 'var(--app-accent)' }}>
                  <span>{analysisStep}</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'var(--app-accent)', transition: 'width 0.3s ease' }}></div>
                </div>
              </div>
            )}
          </section>

          {done && (
            <div className="fade-in">
              <nav style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid var(--color-border-muted)', paddingBottom: '12px' }}>
                {['broll', 'images', 'overlays', 'timeline'].map(t => (
                  <button key={t} className={`btn ${activeTab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(t)}>{t}</button>
                ))}
                <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => downloadAllZip(false)}>📦 EXPORT ZIP</button>
                <button className="btn btn-secondary" onClick={() => downloadAllZip(true)}>📦 EXPORT SELECTED ({selectedIds.size})</button>
              </nav>

              {activeTab === 'broll' && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${settings.previewSize}px, 1fr))`, gap: '24px' }}>
                  {results.filter(r => r.videoUrl).map((r, idx) => (
                    <div key={r.id} className="card animate-card" style={{ padding: 0, overflow: 'hidden', animationDelay: `${idx * 0.05}s` }} onMouseEnter={() => setHoveredId(r.id)} onMouseLeave={() => setHoveredId(null)}>
                      <div style={{ position: 'relative', height: '180px', background: '#000' }}>
                        <div className="scanline" style={{ display: !r.videoUrl ? 'block' : 'none' }}></div>
                        {hoveredId === r.id && r.videoId ? (
                          <iframe src={`https://www.youtube.com/embed/${r.videoId}?autoplay=1&mute=1&controls=0&start=10`} style={{ width: '100%', height: '100%', border: 0 }} allow="autoplay" />
                        ) : (
                          <img src={r.videoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ padding: '16px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--app-accent)', fontWeight: 800 }}>TCODE {r.estimatedTimecode}</div>
                        <h3 style={{ fontSize: '14px', marginTop: '6px' }}>{r.searchQuery}</h3>
                        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px', fontSize: '10px' }} onClick={() => window.open(r.videoUrl, '_blank')}>OPEN STREAM</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'images' && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${settings.previewSize}px, 1fr))`, gap: '24px' }}>
                  {results.filter(r => r.imageUrl && (!settings.onlyHD || r.imageWidth >= 1920)).map((r, idx) => (
                    <div key={r.id} className="card animate-card" style={{ padding: 0, overflow: 'hidden', position: 'relative', animationDelay: `${idx * 0.05}s` }}>
                      <input type="checkbox" style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }} checked={selectedIds.has(r.id)} onChange={() => { const n = new Set(selectedIds); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSelectedIds(n); }} />
                      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-conic-gradient(#1c1e20 0% 25%, #131517 0% 50%) 50% / 20px 20px' }}>
                        <div className="scanline" style={{ display: !r.imageUrl ? 'block' : 'none' }}></div>
                        <img src={r.imageUrl} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800 }}>{r.imageWidth}X{r.imageHeight} RES</div>
                        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '10px', fontSize: '10px' }} onClick={() => handleDownload(r.imageUrl, 'asset.png')}>EXPORT PNG</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'overlays' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <button className={`btn ${overlayCat === 'Script Matches' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setOverlayCat('Script Matches'); setOverlayResults(scriptOverlays); }}>SCRIPT-BASED</button>
                    {Object.keys(OVERLAY_PRESETS).map(cat => <button key={cat} className={`btn ${overlayCat === cat ? 'btn-primary' : 'btn-secondary'}`} onClick={() => loadOverlays(cat)}>{cat}</button>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${settings.previewSize}px, 1fr))`, gap: '24px' }}>
                    {overlayResults.map((r, i) => (
                      <div key={r.q || i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ height: '180px', background: 'repeating-conic-gradient(#1c1e20 0% 25%, #131517 0% 50%) 50% / 20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={r.imageUrl} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ padding: '16px' }}>
                          <h3 style={{ fontSize: '12px' }}>{r.q || r.searchQuery}</h3>
                          <button className="btn btn-primary" style={{ width: '100%', marginTop: '12px', fontSize: '10px' }} onClick={() => handleDownload(r.imageUrl, 'overlay.png')}>DOWNLOAD</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Toast toasts={toasts} />
    </div>
  );
}
