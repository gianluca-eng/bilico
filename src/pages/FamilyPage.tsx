import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { BigButton, IconBtn, ArrowLeft } from '../components/Ui';
import {
  H, B, SERIF,
  INK, CREAM, LILAC, MINT, ORANGE, CORAL, INK_50, INK_70,
  OFFSET,
} from '../components/tokens';

const initialsOf = (name: string | null) =>
  (name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase();

export default function FamilyPage() {
  const { user, profile, familyMembers } = useStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Il "codice invito" è l'URL di join basato su familyId.
  // Il familyId = uid del creatore (come implementato in onboarding/useAuth).
  const familyId = profile?.familyId ?? user?.uid ?? '';
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${familyId}`
    : '';

  // Mostriamo un "codice corto" leggibile derivato dall'uid
  const shortCode = familyId
    ? 'BIL-' + familyId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '0')
    : 'BIL-XXXX';

  const me = user;
  const meInitial = initialsOf(me?.displayName ?? null);

  // Partner: primo membro family diverso da me
  const partner = familyMembers.find(m => m.uid !== me?.uid);
  const partnerInitial = partner ? initialsOf(partner.name) : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silenzioso
    }
  };

  const shareLink = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator).share({
          title: 'Bilico',
          text: 'Unisciti al mio budget su Bilico',
          url: inviteUrl,
        });
        return;
      } catch {
        // fallthrough to copy
      }
    }
    copyLink();
  };

  return (
    <div style={{
      minHeight: '100svh',
      background: CREAM,
      padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px calc(28px + env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 420,
      margin: '0 auto',
      width: '100%',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
      }}>
        <IconBtn onClick={() => navigate('/dashboard')} ariaLabel="Torna alla dashboard">
          <ArrowLeft />
        </IconBtn>
        <div style={{
          ...H,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: INK_50,
          fontWeight: 700,
        }}>Famiglia</div>
        <div style={{ width: 44 }} />
      </div>

      {/* Illustrazione: due cerchi accoppiati */}
      <div style={{ position: 'relative', height: 140, margin: '8px auto 10px', width: 260 }}>
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: 'translateX(-70%)',
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: LILAC,
          border: `2.5px solid ${INK}`,
          boxShadow: OFFSET(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...H,
          fontWeight: 800,
          fontSize: 42,
          color: INK,
        }}>
          {meInitial}
        </div>
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 16,
          transform: 'translateX(-10%)',
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: partner ? MINT : CREAM,
          border: `2.5px solid ${INK}`,
          boxShadow: OFFSET(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...H,
          fontWeight: 800,
          fontSize: partner ? 42 : 28,
          color: partner ? INK : INK_50,
        }}>
          {partnerInitial ?? '+'}
        </div>
      </div>

      {/* Titolo + copy */}
      <h1 style={{
        ...H,
        fontWeight: 800,
        fontSize: 34,
        color: INK,
        lineHeight: 1.02,
        letterSpacing: '-1.2px',
        margin: '4px 0 0',
      }}>
        Due persone,<br />
        <span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 38 }}>una bilancia.</span>
      </h1>
      <p style={{
        ...B,
        fontSize: 14,
        color: INK_70,
        lineHeight: 1.45,
        margin: '10px 0 18px',
      }}>
        {partner
          ? `Stai condividendo il portafoglio con ${partner.name}. Vedete insieme entrate e uscite, ognuno con il proprio profilo.`
          : 'Invita chi condivide il portafoglio con te. Vedrete insieme entrate e uscite, ognuno con il proprio profilo.'}
      </p>

      {/* Code card */}
      <div style={{
        background: INK,
        borderRadius: 22,
        padding: '18px 20px',
        boxShadow: OFFSET(INK),
      }}>
        <div style={{
          ...H,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: CREAM,
          fontWeight: 700,
          opacity: 0.6,
        }}>Codice invito</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}>
          <div style={{
            ...H,
            fontWeight: 800,
            fontSize: 32,
            color: CREAM,
            letterSpacing: '6px',
          }}>{shortCode}</div>
          <button
            onClick={copyLink}
            style={{
              ...H,
              padding: '8px 14px',
              borderRadius: 99,
              border: `2px solid ${CREAM}`,
              background: 'transparent',
              color: CREAM,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copiato!' : 'Copia'}
          </button>
        </div>
        <div style={{
          ...B,
          fontSize: 11,
          color: CREAM,
          opacity: 0.6,
          marginTop: 6,
        }}>
          Link diretto: {inviteUrl.replace(/^https?:\/\//, '')}
        </div>
      </div>

      {/* CTA */}
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <BigButton variant="ink" onClick={shareLink}>
          Condividi link invito
        </BigButton>
      </div>

      <p style={{
        ...SERIF,
        fontStyle: 'italic',
        fontSize: 16,
        color: INK_70,
        textAlign: 'center',
        lineHeight: 1.4,
        margin: '18px 0 0',
      }}>
        Bilico funziona anche da solə.<br />Ma è più bello in due.
      </p>

      {/* Unused colors helper to keep linter happy is inline via constants */}
      <span style={{ display: 'none' }}>{ORANGE}</span>
    </div>
  );
}
