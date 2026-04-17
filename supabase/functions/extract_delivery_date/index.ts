@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Global CSS variables for theme ── */
:root {
  --bg-app:       #eff6ff;
  --bg-base:      #ffffff;
  --bg-muted:     #f9fafb;
  --bg-subtle:    #f3f4f6;
  --border:       #e5e7eb;
  --border-muted: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted:   #9ca3af;
  --shadow:       0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:    0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05);
}

html.dark {
  --bg-app:       #0f172a;
  --bg-base:      #1e293b;
  --bg-muted:     #162032;
  --bg-subtle:    #243347;
  --border:       #334155;
  --border-muted: #1e2d3d;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted:   #475569;
  --shadow:       0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md:    0 4px 6px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3);
}

/* ── Apply theme vars to key elements ── */
body {
  background-color: var(--bg-app);
  color: var(--text-primary);
  transition: background-color 0.2s, color 0.2s;
}

/* Dark mode overrides for common Tailwind classes */
html.dark .bg-white        { background-color: var(--bg-base) !important; }
html.dark .bg-gray-50      { background-color: var(--bg-muted) !important; }
html.dark .bg-gray-100     { background-color: var(--bg-subtle) !important; }
html.dark .bg-gray-200     { background-color: #2d3f55 !important; }
html.dark .border-gray-50  { border-color: var(--border-muted) !important; }
html.dark .border-gray-100 { border-color: var(--border-muted) !important; }
html.dark .border-gray-200 { border-color: var(--border) !important; }
html.dark .text-gray-900   { color: var(--text-primary) !important; }
html.dark .text-gray-800   { color: #e2e8f0 !important; }
html.dark .text-gray-700   { color: #cbd5e1 !important; }
html.dark .text-gray-600   { color: #94a3b8 !important; }
html.dark .text-gray-500   { color: #64748b !important; }
html.dark .text-gray-400   { color: #475569 !important; }
html.dark .text-gray-300   { color: #334155 !important; }
html.dark .shadow-sm       { box-shadow: var(--shadow) !important; }
html.dark .shadow-md       { box-shadow: var(--shadow-md) !important; }
html.dark .shadow-lg       { box-shadow: 0 10px 15px rgba(0,0,0,0.4) !important; }
html.dark .shadow-xl       { box-shadow: 0 20px 25px rgba(0,0,0,0.5) !important; }
html.dark .shadow-2xl      { box-shadow: 0 25px 50px rgba(0,0,0,0.5) !important; }

/* Inputs & forms in dark */
html.dark input,
html.dark textarea,
html.dark select {
  background-color: var(--bg-subtle) !important;
  color: var(--text-primary) !important;
  border-color: var(--border) !important;
}
html.dark input::placeholder,
html.dark textarea::placeholder { color: var(--text-muted) !important; }

/* Hover states in dark */
html.dark .hover\:bg-gray-50:hover  { background-color: var(--bg-subtle) !important; }
html.dark .hover\:bg-gray-100:hover { background-color: #2d3f55 !important; }

/* App background */
html.dark .bg-gradient-to-br { background: var(--bg-app) !important; }
html.dark .from-blue-50,
html.dark .to-indigo-100 { background: var(--bg-app) !important; }

/* Cards & panels */
html.dark .rounded-2xl.bg-white,
html.dark .rounded-xl.bg-white,
html.dark .rounded-lg.bg-white {
  background-color: var(--bg-base) !important;
}

/* Scrollbar in dark */
html.dark ::-webkit-scrollbar { width: 6px; height: 6px; }
html.dark ::-webkit-scrollbar-track { background: var(--bg-muted); }
html.dark ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* ── Mobile improvements ── */
@media (max-width: 768px) {
  /* Larger touch targets */
  button { min-height: 40px; }

  /* Better spacing on mobile */
  .p-6 { padding: 1rem !important; }
  .p-5 { padding: 0.875rem !important; }

  /* Full-width modals on mobile */
  .max-w-md { max-width: calc(100vw - 2rem) !important; }
  .max-w-sm { max-width: calc(100vw - 2rem) !important; }
  .max-w-lg { max-width: calc(100vw - 2rem) !important; }
}

/* ── Existing custom classes ── */
.jb { font-family: 'JetBrains Mono', 'Fira Code', monospace; }

.order-row {
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid transparent;
}
.order-row:hover { background: var(--bg-subtle); }
.order-row.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}
html.dark .order-row:hover { background: var(--bg-subtle); }
html.dark .order-row.active {
  background: #1e3a5f;
  border-color: #2563eb;
}

.dot-p { transition: background 0.3s; }
.ring-p {
  position: absolute; inset: -3px;
  border-radius: 50%;
  animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
  opacity: 0.4;
}
@keyframes ping {
  75%, 100% { transform: scale(2); opacity: 0; }
}

.detail-anim { animation: slideIn 0.2s ease-out; }
@keyframes slideIn {
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
}