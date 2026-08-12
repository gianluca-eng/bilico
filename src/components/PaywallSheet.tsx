import { useState } from 'react';
import { BigButton, IconBtn, CloseX, useEscapeKey } from './Ui';
import {
  H, B, INK, CREAM, ORANGE, MINT, LILAC, SAND,
  INK_70, INK_50, OFFSET, OFFSET_SM,
} from './tokens';
import { TERMS_URL, proManagementUrl, type ProPackage } from '../lib/purchases';
import type { ProState } from '../hooks/usePro';

const BENEFITS: { emoji: string; title: string; text: string }[] = [
  {
    emoji: '📸',
    title: 'Scansiona lo scontrino',
    text: 'Fotografi, Bilico legge il totale e lo mette nella categoria giusta.',
  },
  {
    emoji: '⚡',
    title: 'Niente da digitare',
    text: 'Importo, negozio e categoria compilati da soli.',
  },
  {
    emoji: '♾️',
    title: 'Scansioni senza limiti',
    text: 'Tutti gli scontrini che vuoi, ogni mese.',
  },
];

interface PaywallSheetProps {
  pro: ProState;
  onClose: () => void;
  /** Apre la privacy policy dell'app (link obbligatorio in paywall). */
  onPrivacy: () => void;
}

export default function PaywallSheet({ pro, onClose, onPrivacy }: PaywallSheetProps) {
  useEscapeKey(onClose);

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
        maxHeight: '90svh',
        overflowY: 'auto',
        background: CREAM,
        borderRadius: '26px 26px 0 0',
        border: `2.5px solid ${INK}`,
        borderBottom: 'none',
        padding: '16px 22px calc(26px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        zIndex: 110,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}>
          <div style={{ ...H, fontWeight: 800, fontSize: 18, color: INK }}>
            Bilico PRO
          </div>
          <IconBtn onClick={onClose} ariaLabel="Chiudi"><CloseX /></IconBtn>
        </div>

        {pro.isPro ? <ActiveState /> : <BenefitsList />}

        {!pro.isPro && (
          <div style={{ marginTop: 16 }}>
            <PlansSection pro={pro} />
          </div>
        )}

        {pro.notice && (
          <div
            onClick={pro.clearNotice}
            style={{
              ...B,
              marginTop: 14,
              padding: '12px 14px',
              background: MINT,
              border: `2.5px solid ${INK}`,
              borderRadius: 14,
              fontSize: 13,
              color: INK,
              lineHeight: 1.4,
              cursor: 'pointer',
            }}
          >
            {pro.notice}
          </div>
        )}

        <Legal pro={pro} onPrivacy={onPrivacy} />
      </div>
    </>
  );
}

// ─── Stato "già abbonato" ──────────────────────────────────────────────────

function ActiveState() {
  const [opening, setOpening] = useState(false);

  const manage = async () => {
    setOpening(true);
    const url = await proManagementUrl();
    setOpening(false);
    // Senza URL dallo store, le impostazioni abbonamenti restano la via buona.
    window.open(url ?? 'https://apps.apple.com/account/subscriptions', '_blank');
  };

  return (
    <div>
      <div style={{
        background: MINT,
        border: `2.5px solid ${INK}`,
        borderRadius: 20,
        padding: '16px 18px',
        boxShadow: OFFSET(),
      }}>
        <div style={{ ...H, fontWeight: 800, fontSize: 17, color: INK, marginBottom: 4 }}>
          Il tuo PRO è attivo
        </div>
        <div style={{ ...B, fontSize: 13, color: INK_70, lineHeight: 1.45 }}>
          Scansiona tutti gli scontrini che vuoi. Grazie per il supporto.
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <BigButton variant="cream" onClick={() => void manage()} disabled={opening}>
          {opening ? 'Apro…' : 'Gestisci abbonamento'}
        </BigButton>
      </div>
    </div>
  );
}

// ─── Cosa include ──────────────────────────────────────────────────────────

function BenefitsList() {
  const colors = [ORANGE, LILAC, SAND];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {BENEFITS.map((b, i) => (
        <div key={b.title} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: colors[i % colors.length],
          border: `2.5px solid ${INK}`,
          borderRadius: 16,
          padding: '12px 14px',
          boxShadow: OFFSET_SM(),
        }}>
          <span style={{ fontSize: 20, lineHeight: 1.1 }} aria-hidden>{b.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...H, fontWeight: 800, fontSize: 14, color: INK }}>
              {b.title}
            </div>
            <div style={{ ...B, fontSize: 12.5, color: INK_70, lineHeight: 1.4 }}>
              {b.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Piani ─────────────────────────────────────────────────────────────────

function PlansSection({ pro }: { pro: ProState }) {
  if (!pro.available) {
    return (
      <Info>
        L’abbonamento si attiva dall’app per iPhone o Android. Da browser
        puoi usare Bilico gratis, senza scansione scontrini.
      </Info>
    );
  }

  if (pro.loading) {
    return <Info>Carico i piani…</Info>;
  }

  if (pro.packages.length === 0) {
    return (
      <div>
        <Info>{pro.error ?? 'Nessun piano disponibile in questo momento.'}</Info>
        <div style={{ marginTop: 10 }}>
          <BigButton variant="cream" onClick={pro.reload}>Riprova</BigButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {pro.packages.map((p) => (
        <PlanCard
          key={p.id}
          plan={p}
          busy={pro.purchasingId === p.id}
          disabled={pro.purchasingId !== null}
          onBuy={() => void pro.buy(p)}
        />
      ))}
    </div>
  );
}

function PlanCard({
  plan, busy, disabled, onBuy,
}: {
  plan: ProPackage;
  busy: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  return (
    <button
      onClick={onBuy}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        background: plan.isAnnual ? ORANGE : CREAM,
        border: `2.5px solid ${INK}`,
        borderRadius: 18,
        padding: '14px 16px',
        boxShadow: OFFSET(),
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !busy ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ ...H, fontWeight: 800, fontSize: 15, color: INK }}>
          {plan.title}
        </div>
        <div style={{ ...B, fontSize: 12.5, color: INK_70, lineHeight: 1.35 }}>
          {plan.priceString} {plan.periodLabel}
          {plan.perMonthLabel ? ` · ${plan.perMonthLabel} al mese` : ''}
        </div>
      </div>
      <span style={{
        ...H,
        flexShrink: 0,
        fontWeight: 800,
        fontSize: 13,
        color: CREAM,
        background: INK,
        borderRadius: 99,
        padding: '9px 16px',
      }}>
        {busy ? '…' : 'Attiva'}
      </span>
    </button>
  );
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      ...B,
      background: SAND,
      border: `2.5px solid ${INK}`,
      borderRadius: 16,
      padding: '14px 16px',
      fontSize: 13,
      color: INK_70,
      lineHeight: 1.45,
    }}>
      {children}
    </div>
  );
}

// ─── Ripristino + note legali ──────────────────────────────────────────────
//
// Ripristino acquisti, condizioni di rinnovo, link a termini e privacy sono
// richiesti da App Review per qualsiasi abbonamento (guideline 3.1.2).

function Legal({ pro, onPrivacy }: { pro: ProState; onPrivacy: () => void }) {
  const link: React.CSSProperties = {
    ...B,
    fontSize: 12,
    color: INK,
    textDecoration: 'underline',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  };

  return (
    <div style={{ marginTop: 16 }}>
      {pro.available && (
        <button
          onClick={() => void pro.restore()}
          disabled={pro.restoring}
          style={{
            ...H,
            width: '100%',
            padding: '12px 16px',
            borderRadius: 99,
            border: `2px solid ${INK}`,
            background: 'transparent',
            color: INK,
            fontWeight: 700,
            fontSize: 14,
            cursor: pro.restoring ? 'not-allowed' : 'pointer',
          }}
        >
          {pro.restoring ? 'Ripristino…' : 'Ripristina acquisti'}
        </button>
      )}

      <p style={{
        ...B,
        fontSize: 11.5,
        color: INK_50,
        lineHeight: 1.45,
        margin: '14px 0 0',
      }}>
        Il pagamento è addebitato sul tuo account dello store alla conferma.
        L’abbonamento si rinnova automaticamente allo stesso prezzo, salvo
        disdetta almeno 24 ore prima della fine del periodo in corso. Puoi
        gestirlo o disattivarlo dalle impostazioni del tuo account.
      </p>

      <div style={{
        display: 'flex',
        gap: 16,
        marginTop: 10,
        flexWrap: 'wrap',
      }}>
        <button style={link} onClick={() => window.open(TERMS_URL, '_blank')}>
          Termini d’uso
        </button>
        <button style={link} onClick={onPrivacy}>
          Privacy policy
        </button>
      </div>
    </div>
  );
}
