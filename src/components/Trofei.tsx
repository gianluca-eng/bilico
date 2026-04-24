import { useState } from 'react';
import type { UnlockedBadge } from '../hooks/useBadges';
import type { BadgeDef } from '../lib/badges';
import { IconBtn, CloseX, useEscapeKey } from './Ui';
import {
  H, B, SERIF,
  INK, CREAM, ORANGE, INK_50, INK_70,
  OFFSET, OFFSET_SM,
} from './tokens';

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()} ${[
    'gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic',
  ][d.getMonth()]}`;
};

// ─── Griglia trofei ────────────────────────────────────────────────────────
export function Trofei({ badges }: { badges: UnlockedBadge[] }) {
  const [detail, setDetail] = useState<UnlockedBadge | null>(null);

  const unlocked = badges.filter(b => b.unlockedAt);
  const locked = badges.filter(b => !b.unlockedAt);

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          ...H,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: INK_50,
          fontWeight: 700,
        }}>
          Trofei
        </div>
        <div style={{ ...H, fontSize: 12, color: INK_50, fontWeight: 700 }}>
          {unlocked.length} / {badges.length}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}>
        {[...unlocked, ...locked].map(b => {
          const isUnlocked = !!b.unlockedAt;
          return (
            <button
              key={b.def.id}
              onClick={() => setDetail(b)}
              style={{
                background: isUnlocked ? CREAM : INK + '0D',
                border: `2.5px solid ${isUnlocked ? INK : INK + '55'}`,
                borderRadius: 14,
                padding: '14px 8px 10px',
                boxShadow: isUnlocked ? OFFSET(ORANGE) : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'transform 80ms ease',
                ...H,
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'translate(1px,1px)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'none')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{
                fontSize: 32,
                lineHeight: 1,
                // Locked: nascondi emoji, mostra "?" in stile misterioso
                ...(isUnlocked ? {} : {
                  color: INK + '55',
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: 'italic',
                  fontSize: 36,
                  fontWeight: 400,
                }),
              }}>
                {isUnlocked ? b.def.emoji : '?'}
              </div>
              <div style={{
                ...H,
                fontSize: 10,
                fontWeight: 700,
                color: isUnlocked ? INK : INK + '55',
                textAlign: 'center',
                lineHeight: 1.1,
                marginTop: 4,
                minHeight: 22,
                textTransform: isUnlocked ? 'none' : 'uppercase',
                letterSpacing: isUnlocked ? 0 : 1,
              }}>{isUnlocked ? b.def.name : 'Bloccato'}</div>
            </button>
          );
        })}
      </div>

      {detail && <BadgeDetailModal badge={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ─── Modale dettaglio badge ────────────────────────────────────────────────
function BadgeDetailModal({ badge, onClose }: { badge: UnlockedBadge; onClose: () => void }) {
  useEscapeKey(onClose);
  const isUnlocked = !!badge.unlockedAt;
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,14,14,0.4)',
        zIndex: 100, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 420,
        background: CREAM,
        borderRadius: '26px 26px 0 0',
        border: `2.5px solid ${INK}`,
        borderBottom: 'none',
        padding: '20px 22px calc(28px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        zIndex: 110,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 4,
        }}>
          <IconBtn onClick={onClose} ariaLabel="Chiudi"><CloseX /></IconBtn>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '0 4px 8px',
        }}>
          <div style={{
            fontSize: 72,
            lineHeight: 1,
            marginBottom: 8,
            filter: isUnlocked ? 'none' : 'grayscale(100%)',
            opacity: isUnlocked ? 1 : 0.5,
          }}>
            {badge.def.emoji}
          </div>
          <h2 style={{
            ...H,
            fontWeight: 800,
            fontSize: 26,
            color: INK,
            letterSpacing: '-0.8px',
            margin: 0,
          }}>
            {badge.def.name}
          </h2>

          <p style={{
            ...SERIF,
            fontStyle: 'italic',
            fontSize: 18,
            color: INK,
            lineHeight: 1.35,
            margin: '12px 0 4px',
          }}>
            «{badge.def.quote}»
          </p>
          <p style={{
            ...B,
            fontSize: 12,
            color: INK_50,
            fontWeight: 600,
            margin: 0,
          }}>
            — {badge.def.source}
          </p>
        </div>

        <div style={{
          marginTop: 22,
          background: isUnlocked ? ORANGE : CREAM,
          border: `2.5px solid ${INK}`,
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow: OFFSET_SM(),
        }}>
          <div style={{
            ...H,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: isUnlocked ? CREAM : INK_50,
            fontWeight: 700,
            opacity: isUnlocked ? 0.9 : 1,
          }}>
            {isUnlocked ? 'Sbloccato' : 'Come si sblocca'}
          </div>
          <div style={{
            ...B,
            fontSize: 14,
            color: isUnlocked ? CREAM : INK,
            fontWeight: 600,
            marginTop: 2,
          }}>
            {isUnlocked
              ? `Il ${fmtDate(badge.unlockedAt!)}`
              : badge.def.description}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Toast al momento del nuovo sblocco ────────────────────────────────────
export function BadgeToast({ badge, onDismiss }: { badge: BadgeDef; onDismiss: () => void }) {
  // Auto-dismiss dopo 5 secondi
  useEscapeKey(onDismiss);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        top: 'calc(16px + env(safe-area-inset-top, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: 380,
        background: CREAM,
        border: `2.5px solid ${INK}`,
        borderRadius: 18,
        boxShadow: OFFSET(ORANGE),
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        zIndex: 200,
        animation: 'bilico-toast-in 320ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`
        @keyframes bilico-toast-in {
          from { transform: translate(-50%, -120%); opacity: 0; }
          to   { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>

      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        background: ORANGE,
        border: `2.5px solid ${INK}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        flexShrink: 0,
        boxShadow: OFFSET_SM(),
      }}>
        {badge.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...H,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: ORANGE,
        }}>
          🏆 Nuovo trofeo!
        </div>
        <div style={{
          ...H,
          fontSize: 16,
          fontWeight: 800,
          color: INK,
          letterSpacing: '-0.3px',
          marginTop: 2,
        }}>
          {badge.name}
        </div>
        <div style={{
          ...SERIF,
          fontStyle: 'italic',
          fontSize: 13,
          color: INK_70,
          lineHeight: 1.3,
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          «{badge.quote}»
        </div>
      </div>
    </div>
  );
}
