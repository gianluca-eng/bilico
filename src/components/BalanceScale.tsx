import { useEffect, useState, type CSSProperties } from 'react';
import { INK, CREAM, ORANGE, GREEN, LILAC, OFFSET, fmtN } from './tokens';

export interface BalanceScaleProps {
  spent?: number;
  free?: number;
  size?: 'sm' | 'md' | 'lg';
  /** -22..+22 (in gradi). Se undefined → auto-oscillazione idle. */
  tiltBy?: number;
  animated?: boolean;
  showDecoration?: boolean;
  style?: CSSProperties;
}

/**
 * Bilancia a due piatti — SVG statico con rotazione animata.
 * Default: animazione idle sinusoidale. Passa `tiltBy` per controllo manuale.
 */
export function BalanceScale({
  spent = 0,
  free = 0,
  size = 'lg',
  tiltBy,
  animated = true,
  showDecoration = true,
  style,
}: BalanceScaleProps) {
  const [auto, setAuto] = useState(0);

  useEffect(() => {
    if (!animated || tiltBy !== undefined) return;
    let f = 0;
    let raf = 0;
    const tick = () => {
      f += 1;
      setAuto(Math.sin(f / 80) * 2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animated, tiltBy]);

  const tilt = tiltBy !== undefined ? tiltBy : auto;
  const scale = size === 'lg' ? 1 : size === 'md' ? 0.75 : 0.55;
  const W = 300 * scale;
  const Hh = 180 * scale;

  return (
    <div style={{ position: 'relative', width: W, height: Hh, margin: '0 auto', ...style }}>
      {showDecoration && size === 'lg' && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -6,
            left: -6,
            width: 38,
            height: 38,
            background: LILAC,
            borderRadius: 9,
            transform: 'rotate(-16deg)',
            border: `2.5px solid ${INK}`,
            boxShadow: OFFSET(),
            zIndex: 2,
          }}
        />
      )}

      {/* Telaio fisso: base + palo + fulcro */}
      <svg width={W} height={Hh} viewBox="0 0 300 180" style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <rect x="115" y="164" width="70" height="5" rx="2" fill={INK} />
        <path d="M118 164 L148 108" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M182 164 L152 108" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <line x1="150" y1="108" x2="150" y2="90" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="150" cy="86" r="4.5" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      </svg>

      {/* Braccio che ruota */}
      <svg
        width={W}
        height={Hh}
        viewBox="0 0 300 180"
        style={{
          position: 'absolute',
          inset: 0,
          transform: `rotate(${tilt}deg)`,
          transformOrigin: '150px 86px',
          transition: 'transform 120ms linear',
        }}
        role="img"
        aria-label={`Speso ${spent} euro, libero ${free} euro`}
      >
        <line x1="40" y1="86" x2="260" y2="86" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />

        {/* LEFT — speso */}
        <line x1="80" y1="86" x2="80" y2="54" stroke={INK} strokeWidth="2" />
        <rect x="46" y="34" width="68" height="22" rx="11" fill={CREAM} stroke={INK} strokeWidth="2" />
        <text x="80" y="50" textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="700" fontSize="12" fill={INK}>
          {fmtN(spent)}
        </text>
        <path d="M 48 86 A 32 32 0 0 0 112 86 Z" fill={ORANGE} stroke={INK} strokeWidth="2.5" />
        <text x="80" y="104" textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="800" fontSize="11" fill={CREAM} letterSpacing="0.8">SPESO</text>

        {/* RIGHT — libero */}
        <line x1="220" y1="86" x2="220" y2="54" stroke={INK} strokeWidth="2" />
        <rect x="184" y="34" width="72" height="22" rx="11" fill={CREAM} stroke={INK} strokeWidth="2" />
        <text x="220" y="50" textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="700" fontSize="12" fill={INK}>
          {fmtN(free)}
        </text>
        <path d="M 188 86 A 32 32 0 0 0 252 86 Z" fill={GREEN} stroke={INK} strokeWidth="2.5" />
        <text x="220" y="104" textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="800" fontSize="11" fill={CREAM} letterSpacing="0.8">LIBERO</text>
      </svg>
    </div>
  );
}

/**
 * Wordmark — logo Bilico (due stanghette: sx inclinata, dx dritta).
 */
export function Wordmark({ color = INK, size = 22 }: { color?: string; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size + 2} viewBox="0 0 22 24" aria-hidden>
        <rect x="2" y="3" width="6" height="20" rx="2.5" fill={color} transform="rotate(-10 5 23)" />
        <rect x="14" y="1" width="6" height="22" rx="2.5" fill={color} />
      </svg>
      <span style={{
        fontFamily: "'Bricolage Grotesque', sans-serif",
        fontWeight: 800,
        fontSize: size,
        color,
        letterSpacing: '-0.8px',
      }}>
        Bilico
      </span>
    </div>
  );
}

/**
 * EuroPill — cerchietto con "€" stile neo-brutalist.
 */
export function EuroPill({ color = ORANGE, size = 46 }: { color?: string; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      border: `2.5px solid ${INK}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: OFFSET(),
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: "'Bricolage Grotesque', sans-serif",
        fontWeight: 800,
        fontSize: size * 0.48,
        color: CREAM,
        lineHeight: 1,
      }}>€</span>
    </div>
  );
}
