import { useEffect, type CSSProperties, type ReactNode } from 'react';
import {
  H, B, SERIF,
  INK, CREAM, ORANGE, MINT, CORAL, INK_50,
  OFFSET, OFFSET_SM,
} from './tokens';

/**
 * useEscapeKey — chiude un modal quando l'utente preme Escape.
 * Passa il callback `onClose`; si attiva automaticamente finché
 * il componente è montato.
 */
export function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}

// ─── Bottoni ──────────────────────────────────────────────────────────────

export interface BigButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'ink' | 'orange' | 'cream';
  icon?: ReactNode;
  disabled?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}

export function BigButton({
  children, onClick, variant = 'ink', icon = null,
  disabled = false, style = {}, type = 'button',
}: BigButtonProps) {
  const bg = variant === 'ink' ? INK : variant === 'orange' ? ORANGE : CREAM;
  const fg = variant === 'cream' ? INK : CREAM;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...H,
        width: '100%',
        padding: '16px 20px',
        borderRadius: 99,
        border: `2.5px solid ${INK}`,
        background: bg,
        color: fg,
        fontWeight: 700,
        fontSize: 16,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        boxShadow: OFFSET(),
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {icon}{children}
    </button>
  );
}

export interface ChipPillProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  style?: CSSProperties;
}

export function ChipPill({
  children, active = false, onClick, color = MINT, style = {},
}: ChipPillProps) {
  return (
    <button
      onClick={onClick}
      style={{
        ...H,
        padding: '10px 16px',
        borderRadius: 99,
        border: `2px solid ${INK}`,
        background: active ? color : CREAM,
        color: INK,
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        boxShadow: active ? OFFSET_SM() : 'none',
        transform: active ? 'translate(-1px,-1px)' : 'none',
        transition: 'transform 80ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Card / Panel ────────────────────────────────────────────────────────

export interface PanelProps {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export function Panel({ children, color = CREAM, style = {} }: PanelProps) {
  return (
    <div style={{
      background: color,
      border: `2.5px solid ${INK}`,
      borderRadius: 20,
      boxShadow: OFFSET(),
      padding: 18,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Editorial heading (con parola serif italica) ────────────────────────

export interface EditorialH1Props {
  pre?: string;
  italic: string;
  post?: string;
  size?: number;
  color?: string;
  italicColor?: string;
  style?: CSSProperties;
}

export function EditorialH1({
  pre, italic, post,
  size = 36,
  color = INK,
  italicColor = CORAL,
  style = {},
}: EditorialH1Props) {
  return (
    <h1 style={{
      ...H,
      fontWeight: 800,
      fontSize: size,
      color,
      lineHeight: 1.02,
      letterSpacing: '-1.2px',
      margin: 0,
      ...style,
    }}>
      {pre}{pre && <br />}
      <span style={{
        ...SERIF,
        fontStyle: 'italic',
        fontWeight: 400,
        color: italicColor,
        fontSize: size * 1.12,
      }}>
        {italic}
      </span>
      {post ? <> {post}</> : null}
    </h1>
  );
}

// ─── Icon button tondo ───────────────────────────────────────────────────

export interface IconBtnProps {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function IconBtn({ children, onClick, style = {}, ariaLabel }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 44,
        height: 44,
        borderRadius: 99,
        border: `2px solid ${INK}`,
        background: CREAM,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: OFFSET_SM(),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Step dots (indicator per onboarding) ────────────────────────────────

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 22 : 8,
          height: 8,
          borderRadius: 99,
          background: i <= current ? INK : 'transparent',
          border: `2px solid ${INK}`,
          transition: 'width 180ms ease',
        }} />
      ))}
    </div>
  );
}

// ─── Icone freccia e chiudi ──────────────────────────────────────────────

export function ArrowLeft({ color = INK }: { color?: string }) {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
      <path d="M7 1L1 7L7 13" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 7H17" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowRight({ color = CREAM }: { color?: string }) {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
      <path d="M11 1L17 7L11 13" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 7H1" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function CloseX({ color = INK }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1 1L13 13M13 1L1 13" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Shell per pagine onboarding ─────────────────────────────────────────

export interface OnbShellProps {
  step: number;
  total: number;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
}

export function OnbShell({
  step, total, title, subtitle, children,
  onBack, onNext, nextLabel = 'Continua',
  nextDisabled = false, saving = false,
}: OnbShellProps) {
  return (
    <div style={{
      minHeight: '100svh',
      background: CREAM,
      padding: 'calc(40px + env(safe-area-inset-top, 0px)) 22px calc(28px + env(safe-area-inset-bottom, 0px))',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      maxWidth: 420,
      margin: '0 auto',
      width: '100%',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 22,
      }}>
        {onBack ? <IconBtn onClick={onBack} ariaLabel="Indietro"><ArrowLeft /></IconBtn> : <div style={{ width: 44 }} />}
        <StepDots total={total} current={step} />
        <div style={{ ...H, fontWeight: 700, fontSize: 13, color: INK_50 }}>{step + 1}/{total}</div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{
          ...H,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: INK_50,
          fontWeight: 700,
          marginBottom: 6,
        }}>
          Onboarding
        </div>
        <h1 style={{
          ...H,
          fontWeight: 800,
          fontSize: 30,
          color: INK,
          lineHeight: 1.05,
          letterSpacing: '-1px',
          margin: 0,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            ...B,
            fontSize: 14,
            color: 'rgba(14,14,14,0.72)',
            lineHeight: 1.45,
            margin: '8px 0 0',
            maxWidth: 320,
          }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', marginTop: 8 }}>
        {children}
      </div>

      <div style={{ paddingTop: 12 }}>
        <BigButton
          variant="ink"
          onClick={onNext}
          disabled={nextDisabled || saving}
          icon={<ArrowRight />}
        >
          {saving ? 'Salvo…' : nextLabel}
        </BigButton>
      </div>
    </div>
  );
}
