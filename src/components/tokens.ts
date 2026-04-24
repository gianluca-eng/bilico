// ─── Design tokens Bilico (redesign 2) ──────────────────────────────
// Palette neo-brutalist con accenti editoriali serif (Instrument Serif).
import type { CSSProperties } from 'react';

export const CREAM  = '#FAF2E3';
export const SAND   = '#E9DDC6';
export const INK    = '#0E0E0E';
export const ORANGE = '#EC5A2C';
export const GREEN  = '#2FB174';
export const LILAC  = '#C9B8E6';
export const MINT   = '#A6DCCB';
export const CORAL  = '#F05E3A';

// Legacy aliases: ancora usati in qualche punto storico (JoinPage, splash, ecc.)
export const BLUE  = '#2D6BE4';
export const BG    = CREAM;
export const WHITE = '#FFFFFF';

// Ink alpha helpers
export const INK_70 = 'rgba(14,14,14,0.72)';
export const INK_50 = 'rgba(14,14,14,0.55)';
export const INK_30 = 'rgba(14,14,14,0.32)';
export const INK_15 = 'rgba(14,14,14,0.15)';

// Type-safe CSS font objects
export const H:     CSSProperties = { fontFamily: "'Bricolage Grotesque', sans-serif" };
export const B:     CSSProperties = { fontFamily: "'Epilogue', sans-serif" };
export const SERIF: CSSProperties = { fontFamily: "'Instrument Serif', serif" };

// Hard drop-shadow helpers (neo-brutalist offset)
export const OFFSET    = (c: string = INK) => `3px 3px 0 ${c}`;
export const OFFSET_SM = (c: string = INK) => `2px 2px 0 ${c}`;

// ─── Formatters ────────────────────────────────────────────────────────────
export const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export const fmt2 = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);

// Formato italiano "1.234 €" (niente simbolo all'inizio)
export const fmtN = (n: number) =>
  n.toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €';
