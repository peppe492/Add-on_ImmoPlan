/* =========================================================================
   ImmoPlan Admin Panel - Stylesheet (Bento Cyber Design v2 Refined)
   ========================================================================= */

export const IPB_ADMIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

/* =========================================================================
   VARIABLES & COLOR TOKENS
   ========================================================================= */
.ipb {
  --font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --mono: 'JetBrains Mono', monospace;

  /* Cyber Bento Dark Theme (Default) */
  --bg: #090d16;
  --card-bg: rgba(15, 23, 42, 0.85);
  --card-gradient: linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.85) 100%);
  --card-border: rgba(255, 255, 255, 0.08);
  --card-border-hover: rgba(255, 255, 255, 0.16);
  --inset: rgba(11, 17, 32, 0.7);
  --inset-card: #0c121e;

  --text: #f1f5f9;
  --dim: #94a3b8;
  --faint: #64748b;

  --accent-blue: #3b82f6;
  --accent-cyan: #06b6d4;
  --accent-emerald: #10b981;
  --accent-pink: #ec4899;
  --accent-amber: #f59e0b;
  --accent-purple: #a855f7;
  --accent-rose: #f43f5e;

  --glow-cyan: rgba(6, 182, 212, 0.15);
  --glow-blue: rgba(59, 130, 246, 0.18);
  --glow-rose: rgba(244, 63, 94, 0.15);

  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;

  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  min-height: 100%;
  padding-bottom: 30px;
}

/* Default Chiaro (Light Theme) */
.ipb.light {
  --bg: #f4f6fb;
  --card-bg: #ffffff;
  --card-gradient: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  --card-border: rgba(15, 23, 42, 0.08);
  --card-border-hover: rgba(15, 23, 42, 0.16);
  --inset: #f1f4f9;
  --inset-card: #f8fafc;

  --text: #0f172a;
  --dim: #475569;
  --faint: #94a3b8;

  --accent-blue: #2563eb;
  --accent-cyan: #0891b2;
  --accent-emerald: #059669;
  --accent-pink: #db2777;
  --accent-amber: #d97706;
  --accent-purple: #9333ea;
  --accent-rose: #e11d48;

  --glow-cyan: rgba(8, 145, 178, 0.10);
  --glow-blue: rgba(37, 99, 235, 0.12);
  --glow-rose: rgba(225, 29, 72, 0.08);
}

.ipb * {
  box-sizing: border-box;
}

.ipb-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* =========================================================================
   HERO BAR & HEADER
   ========================================================================= */
.ipb-hero {
  position: relative;
  overflow: hidden;
  background: var(--card-gradient);
  border: 1px solid var(--card-border);
  border-radius: var(--r-xl);
  padding: 24px 28px;
  box-shadow: 0 4px 20px -5px var(--glow-cyan);
}

.ipb-hero-glow {
  position: absolute;
  top: -80px;
  right: -50px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: var(--glow-cyan);
  filter: blur(60px);
  pointer-events: none;
}

.ipb-hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 900px) {
  .ipb-hero-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.ipb-hero-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.ipb-badge {
  font-family: var(--mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 3px 9px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ipb-badge.cyan {
  background: rgba(6, 182, 212, 0.12);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.ipb-badge.emerald {
  background: rgba(16, 185, 129, 0.12);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.ipb-badge.faint {
  background: rgba(100, 116, 139, 0.12);
  color: var(--dim);
  border: 1px solid var(--card-border);
}

.ipb-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-emerald);
  box-shadow: 0 0 8px var(--accent-emerald);
  display: inline-block;
  animation: ipb-pulse 2s infinite ease-in-out;
}

.ipb-pulse-dot.mini {
  width: 6px;
  height: 6px;
}

@keyframes ipb-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.ipb-hero-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text);
}

.ipb-hero-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--dim);
  max-width: 680px;
  line-height: 1.5;
}

/* Nav Pills */
.ipb-nav-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  align-self: flex-start;
}

@media (min-width: 900px) {
  .ipb-nav-pills {
    align-self: center;
  }
}

.ipb-pill {
  border: 1px solid var(--card-border);
  background: var(--inset);
  color: var(--dim);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: 7px 13px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ipb-pill:hover {
  color: var(--text);
  border-color: var(--card-border-hover);
}

.ipb-pill.active {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(59, 130, 246, 0.4);
  color: var(--accent-blue);
  box-shadow: 0 0 14px -3px var(--glow-blue);
}

/* Flash highlight animation for jumping to sections */
.ipb-highlight-flash {
  animation: ipb-flash 1.2s ease-out;
}

@keyframes ipb-flash {
  0% { box-shadow: 0 0 0 3px var(--accent-blue), 0 0 25px var(--glow-blue); }
  100% { box-shadow: none; }
}

/* =========================================================================
   12-COLUMN BENTO GRID
   ========================================================================= */
.ipb-bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}

.ipb-card {
  background: var(--card-gradient);
  border: 1px solid var(--card-border);
  border-radius: var(--r-xl);
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  backdrop-filter: blur(12px);
}

.ipb-card:hover {
  border-color: var(--card-border-hover);
}

/* Column spans */
.span-12 { grid-column: span 12; }
.span-8  { grid-column: span 8; }
.span-7  { grid-column: span 7; }
.span-6  { grid-column: span 6; }
.span-5  { grid-column: span 5; }
.span-4  { grid-column: span 4; }

@media (max-width: 1024px) {
  .span-8, .span-7, .span-6, .span-5, .span-4 {
    grid-column: span 12;
  }
}

/* Card Header */
.ipb-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--card-border);
}

.ipb-card-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ipb-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.ipb-card-subtitle {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--dim);
}

/* Icon Wraps */
.ipb-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: var(--r-md);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.ipb-icon-wrap.blue {
  background: rgba(59, 130, 246, 0.12);
  color: var(--accent-blue);
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.ipb-icon-wrap.emerald {
  background: rgba(16, 185, 129, 0.12);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.ipb-icon-wrap.amber {
  background: rgba(245, 158, 11, 0.12);
  color: var(--accent-amber);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.ipb-icon-wrap.purple {
  background: rgba(168, 85, 247, 0.12);
  color: var(--accent-purple);
  border: 1px solid rgba(168, 85, 247, 0.25);
}

.ipb-icon-wrap.cyan {
  background: rgba(6, 182, 212, 0.12);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.ipb-icon-wrap.rose {
  background: rgba(244, 63, 94, 0.12);
  color: var(--accent-rose);
  border: 1px solid rgba(244, 63, 94, 0.25);
}

/* Card Footer */
.ipb-card-footer {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ipb-card-footer.split-footer {
  justify-content: space-between;
}

.ipb-card-footer.end-footer {
  justify-content: flex-end;
}

/* =========================================================================
   FORM CONTROLS & INPUTS
   ========================================================================= */
.ipb-input {
  width: 100%;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  padding: 9px 12px;
  outline: none;
  transition: all 0.2s ease;
}

.ipb-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.ipb-input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.ipb-input.mono {
  font-family: var(--mono);
}

.ipb-input.bare {
  border: none;
  background: transparent;
  padding-left: 4px;
  box-shadow: none !important;
}

.ipb-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  cursor: pointer;
}

.ipb-prefixed-input {
  display: flex;
  align-items: center;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  overflow: hidden;
  transition: border-color 0.2s;
}

.ipb-prefixed-input:focus-within {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.ipb-prefix-label {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--faint);
  padding: 0 0 0 10px;
  white-space: nowrap;
}

.ipb-field label {
  display: block;
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 6px;
}

.ipb-field-desc {
  font-size: 11.5px;
  color: var(--dim);
  margin: 8px 0 0;
  line-height: 1.4;
}

.ipb-link-accent {
  color: var(--accent-amber);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.ipb-link-accent:hover {
  text-decoration: underline;
}

.ipb-key-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.ipb-btn-text-danger {
  border: none;
  background: transparent;
  color: var(--accent-rose);
  font-size: 11px;
  font-family: var(--mono);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.2s;
}

.ipb-btn-text-danger:hover {
  opacity: 0.8;
  text-decoration: underline;
}

/* =========================================================================
   BUTTONS
   ========================================================================= */
.ipb-btn {
  border: none;
  cursor: pointer;
  font-family: var(--font);
  font-weight: 700;
  font-size: 11.5px;
  letter-spacing: 0.03em;
  padding: 9px 15px;
  border-radius: var(--r-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.ipb-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ipb-btn.wide {
  width: 100%;
}

.ipb-btn-primary {
  background: linear-gradient(135deg, var(--accent-blue) 0%, #4f46e5 100%);
  color: #ffffff;
  box-shadow: 0 4px 14px -2px var(--glow-blue);
}

.ipb-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 6px 18px -2px var(--glow-blue);
}

.ipb-btn-amber {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-amber);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.ipb-btn-amber:hover {
  background: rgba(245, 158, 11, 0.25);
}

.ipb-btn-cyan {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.ipb-btn-cyan:hover:not(:disabled) {
  background: rgba(6, 182, 212, 0.25);
}

.ipb-btn-cyan.busy {
  cursor: wait;
}

.ipb-btn-danger {
  background: linear-gradient(135deg, var(--accent-rose) 0%, #be123c 100%);
  color: #ffffff;
  box-shadow: 0 4px 14px -2px var(--glow-rose);
}

.ipb-btn-danger:hover {
  filter: brightness(1.1);
}

.ipb-btn-ghost-sm {
  border: 1px solid var(--card-border);
  background: var(--inset);
  color: var(--accent-blue);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: var(--r-sm);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.2s;
}

.ipb-btn-ghost-sm:hover:not(:disabled) {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.1);
}

.ipb-btn-ghost-sm.busy {
  cursor: wait;
  opacity: 0.6;
}

.ipb-btn-ghost-sm.emerald-ghost {
  color: var(--accent-emerald);
}

.ipb-btn-ghost-sm.emerald-ghost:hover:not(:disabled) {
  border-color: var(--accent-emerald);
  background: rgba(16, 185, 129, 0.1);
}

.ipb-btn-trash {
  width: 30px;
  height: 30px;
  border-radius: var(--r-sm);
  border: none;
  background: transparent;
  color: var(--faint);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.ipb-btn-trash:hover {
  color: var(--accent-rose);
  background: rgba(244, 63, 94, 0.12);
}

/* =========================================================================
   ROW 1: USERS & DATABASE
   ========================================================================= */
.ipb-users-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 4px 0;
}

@media (max-width: 640px) {
  .ipb-users-grid {
    grid-template-columns: 1fr;
  }
}

.ipb-user-box {
  background: var(--inset);
  border-radius: var(--r-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s;
}

.ipb-user-box.blue-box {
  border: 1px solid rgba(59, 130, 246, 0.22);
}

.ipb-user-box.blue-box:focus-within {
  border-color: var(--accent-blue);
}

.ipb-user-box.pink-box {
  border: 1px solid rgba(236, 72, 153, 0.22);
}

.ipb-user-box.pink-box:focus-within {
  border-color: var(--accent-pink);
}

.ipb-user-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ipb-user-tag {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ipb-user-tag.blue { color: var(--accent-blue); }
.ipb-user-tag.pink { color: var(--accent-pink); }

.ipb-user-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.ipb-user-dot.blue { background: var(--accent-blue); box-shadow: 0 0 6px var(--accent-blue); }
.ipb-user-dot.pink { background: var(--accent-pink); box-shadow: 0 0 6px var(--accent-pink); }

.ipb-initial-badge {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--dim);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 7px;
  border-radius: 6px;
}

.ipb-initial-badge strong {
  color: var(--text);
}

.ipb-user-hint {
  margin: 0;
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.3;
}

.ipb-feedback-area {
  min-height: 20px;
  display: flex;
  align-items: center;
}

.ipb-success-text {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent-emerald);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ipb-dim-note {
  font-size: 11px;
  color: var(--faint);
}

.ipb-dim-note.mono {
  font-family: var(--mono);
}

.ipb-status-pill {
  font-family: var(--mono);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
}

.ipb-status-pill.ok {
  background: rgba(16, 185, 129, 0.12);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

/* Stat Grid */
.ipb-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 4px 0 8px;
}

@media (max-width: 640px) {
  .ipb-stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.ipb-stat-cell {
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: 12px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ipb-stat-key {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dim);
}

.ipb-stat-val {
  font-family: var(--mono);
  font-size: 22px;
  font-weight: 700;
  margin: 3px 0;
}

.ipb-stat-val.text-white { color: var(--text); }
.ipb-stat-val.text-cyan { color: var(--accent-cyan); }
.ipb-stat-val.text-emerald { color: var(--accent-emerald); }
.ipb-stat-val.text-amber { color: var(--accent-amber); }

.ipb-stat-sub {
  font-size: 9.5px;
  color: var(--faint);
}

.ipb-sub-stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px 10px;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-sm);
  margin-bottom: 4px;
}

.ipb-sub-stat-pill {
  font-size: 10.5px;
  color: var(--dim);
  font-family: var(--mono);
}

.ipb-sub-stat-pill strong {
  color: var(--text);
}

/* =========================================================================
   ROW 2: GEMINI API & THEME
   ========================================================================= */
.ipb-key-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ipb-key-input-row {
  position: relative;
  display: flex;
  align-items: center;
}

.ipb-key-input-row .ipb-input {
  padding-right: 38px;
}

.ipb-input-addon-btn {
  position: absolute;
  right: 6px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--faint);
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: var(--r-sm);
  transition: color 0.2s;
}

.ipb-input-addon-btn:hover {
  color: var(--text);
}

.ipb-theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ipb-theme-card {
  border: 1px solid var(--card-border);
  background: var(--inset);
  border-radius: var(--r-md);
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: all 0.2s ease;
}

.ipb-theme-card:hover {
  border-color: var(--card-border-hover);
}

.ipb-theme-card.active {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.ipb-theme-preview {
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 15px;
  flex-shrink: 0;
}

.ipb-theme-preview.light-swatch {
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #cbd5e1;
}

.ipb-theme-preview.dark-swatch {
  background: #090d16;
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.4);
  box-shadow: 0 0 10px -2px var(--glow-cyan);
}

.ipb-theme-info {
  display: flex;
  flex-direction: column;
}

.ipb-theme-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text);
}

.ipb-theme-desc {
  font-size: 10px;
  color: var(--dim);
  margin-top: 1px;
}

.ipb-active-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-blue);
  box-shadow: 0 0 8px var(--accent-blue);
}

/* =========================================================================
   ROW 3: SENSORS & DANGER ZONE
   ========================================================================= */
.ipb-sensors-container {
  margin-bottom: 16px;
}

.ipb-empty-sensors {
  background: var(--inset);
  border: 1px dashed var(--card-border);
  border-radius: var(--r-md);
  padding: 24px;
  text-align: center;
  color: var(--dim);
  font-size: 12px;
}

.ipb-sensors-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.ipb-sensor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: 9px 12px;
  transition: border-color 0.2s;
}

.ipb-sensor-item:hover {
  border-color: var(--card-border-hover);
}

.ipb-sensor-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ipb-sensor-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: 0 0 6px var(--accent-cyan);
  flex-shrink: 0;
}

.ipb-sensor-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.ipb-sensor-id {
  font-size: 10px;
  color: var(--faint);
  margin-top: 1px;
}

.ipb-sensor-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ipb-sensor-target-tag {
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.12);
  color: var(--dim);
  border: 1px solid var(--card-border);
}

.ipb-sensor-tag {
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(6, 182, 212, 0.12);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

/* Add sensor form grid */
.ipb-add-sensor-box {
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: 14px;
}

.ipb-add-title {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 10px;
}

.ipb-add-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (max-width: 820px) {
  .ipb-add-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .ipb-add-grid {
    grid-template-columns: 1fr;
  }
}

.ipb-add-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ipb-sensor-preview-note {
  font-size: 10.5px;
  color: var(--faint);
}

.ipb-sensor-preview-note strong {
  color: var(--accent-cyan);
}

/* Danger Zone */
.ipb-danger-card {
  border-color: rgba(244, 63, 94, 0.22);
  background: linear-gradient(180deg, rgba(244, 63, 94, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%);
}

.ipb-danger-body {
  margin: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ipb-danger-callout {
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.25);
  border-radius: var(--r-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ipb-callout-header {
  font-size: 11.5px;
  color: var(--accent-rose);
  display: flex;
  align-items: center;
  gap: 7px;
}

.ipb-callout-text {
  margin: 0;
  font-size: 11.5px;
  color: var(--dim);
  line-height: 1.45;
}

.ipb-confirm-drawer {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid var(--accent-rose);
  border-radius: var(--r-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: ipb-fade-in 0.2s ease-out;
}

@keyframes ipb-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.ipb-confirm-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--accent-rose);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ipb-confirm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* =========================================================================
   ROW 4: TERMINAL LOGS
   ========================================================================= */
.ipb-terminal-card {
  padding: 0;
  overflow: hidden;
  border-color: var(--card-border);
}

.ipb-terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  background: var(--inset-card);
  border-bottom: 1px solid var(--card-border);
}

.ipb-mac-dots {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ipb-mac-dots .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.ipb-mac-dots .dot.red     { background: #ef4444; }
.ipb-mac-dots .dot.amber   { background: #f59e0b; }
.ipb-mac-dots .dot.emerald { background: #10b981; }

.ipb-terminal-title {
  font-size: 11px;
  color: var(--dim);
  margin-left: 6px;
}

.ipb-terminal-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ipb-terminal-filter-pills {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ipb-mini-pill {
  border: 1px solid var(--card-border);
  background: var(--inset);
  color: var(--dim);
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.ipb-mini-pill:hover {
  color: var(--text);
  border-color: var(--card-border-hover);
}

.ipb-mini-pill.active {
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent-blue);
  border-color: rgba(59, 130, 246, 0.35);
}

.ipb-terminal-search {
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 10.5px;
  padding: 4px 8px;
  outline: none;
  width: 130px;
  transition: all 0.2s;
}

.ipb-terminal-search:focus {
  width: 170px;
  border-color: var(--accent-blue);
}

.ipb-event-counter {
  font-size: 10.5px;
  color: var(--faint);
  display: flex;
  align-items: center;
  gap: 5px;
}

.ipb-terminal-body {
  background: rgba(5, 8, 15, 0.95);
  padding: 14px 16px;
  height: 240px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.8;
}

.ipb.light .ipb-terminal-body {
  background: #0f172a;
  color: #f1f5f9;
}

.ipb-log-empty {
  color: var(--faint);
  font-style: italic;
  margin: 0;
}

.ipb-log-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11.5px;
}

.ipb-log-time {
  color: var(--faint);
  flex-shrink: 0;
}

.ipb-log-badge {
  font-weight: 700;
  flex-shrink: 0;
}

.ipb-log-badge.info    { color: var(--accent-cyan); }
.ipb-log-badge.success { color: var(--accent-emerald); }
.ipb-log-badge.error   { color: var(--accent-rose); }
.ipb-log-badge.warn    { color: var(--accent-amber); }

.ipb-log-msg {
  color: #cbd5e1;
  word-break: break-word;
}

.ipb-log-row:hover .ipb-log-msg {
  color: #ffffff;
}

.ipb-log-opendata-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}

.ipb-log-row.opendata-row {
  background: rgba(56, 189, 248, 0.04);
  padding: 2px 6px;
  border-radius: 6px;
}

/* Utilities */
.text-accent  { color: var(--accent-blue); }
.text-rose    { color: var(--accent-rose); }
.mono         { font-family: var(--mono); }
`;
