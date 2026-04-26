import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { useAuth } from '../hooks/useAuth';
import type { UserProfile, FamilyMember } from '../types';
import { BigButton, IconBtn, ArrowLeft } from '../components/Ui';
import { Wordmark } from '../components/BalanceScale';
import {
  H, B, SERIF,
  INK, CREAM, ORANGE, GREEN, LILAC, MINT, CORAL, INK_70,
  OFFSET,
} from '../components/tokens';

// Colori dei membri (compatibili con gli altri hook)
const MEMBER_BLUE = '#2D6BE4';
const PARTNER_COLOR = ORANGE;

export default function JoinPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  const { profile, authLoading, setProfile, setFamilyMembers } = useStore();

  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [signing, setSigning] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Carica il nome del creatore SOLO quando l'utente è loggato
  // (le regole Firestore richiedono auth per read)
  useEffect(() => {
    if (!familyId || !user) return;
    setLoadingCreator(true);
    setError('');
    getDoc(doc(db, 'users', familyId))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          const creator = data.familyMembers?.find(m => m.uid === familyId);
          setCreatorName(creator?.name ?? 'qualcuno');
        } else {
          setError('Link non valido o scaduto.');
        }
      })
      .catch(err => {
        console.warn('[join] creator load failed:', err);
        setError('Non riesco a leggere questo invito. Controlla la connessione.');
      })
      .finally(() => setLoadingCreator(false));
  }, [familyId, user]);

  const handleSignIn = async () => {
    setError('');
    setSigning(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accesso non riuscito');
    } finally {
      setSigning(false);
    }
  };

  /**
   * Pre-iscrizione "scheletro" prima dell'onboarding.
   * Usata quando l'utente clicca il link e non ha ancora un profilo:
   * gli creiamo un doc users/{uid} già dentro la famiglia, poi
   * lo mandiamo all'onboarding che si limita a chiedergli reddito.
   */
  const handleConfigureAccount = async () => {
    if (!user || !familyId) return;

    if (user.uid === familyId) {
      setError('Non puoi unirti al tuo stesso gruppo!');
      return;
    }

    setJoining(true);
    setError('');
    try {
      const partnerMember: FamilyMember = {
        uid: user.uid,
        name: user.displayName ?? 'Partner',
        color: PARTNER_COLOR,
      };

      // 1. Aggiungi me ai membri del creatore
      const creatorSnap = await getDoc(doc(db, 'users', familyId));
      if (creatorSnap.exists()) {
        const creatorProfile = creatorSnap.data() as UserProfile;
        const existing = creatorProfile.familyMembers ?? [];
        const already = existing.some(m => m.uid === user.uid);
        const updatedMembers: FamilyMember[] = already
          ? existing
          : [...existing, partnerMember];
        await updateDoc(doc(db, 'users', familyId), { familyMembers: updatedMembers });
      }

      // 2. Crea profilo scheletro (NON ancora onboardato) già con familyId del gruppo
      const creatorMemberEntry: FamilyMember = {
        uid: familyId,
        name: creatorName ?? 'Partner',
        color: MEMBER_BLUE,
      };
      const myMember: FamilyMember = {
        uid: user.uid,
        name: user.displayName ?? 'Partner',
        color: PARTNER_COLOR,
      };
      const skeleton: UserProfile = {
        goal: 'control',
        income: 0,
        fixedExpenses: [],
        categories: [],
        onboardingComplete: false, // l'onboarding successivo lo metterà true
        createdAt: new Date().toISOString(),
        familyId,
        familyMembers: [creatorMemberEntry, myMember],
      };
      await setDoc(doc(db, 'users', user.uid), skeleton);

      // 3. Aggiorna lo store locale
      setProfile(skeleton);
      setFamilyMembers([creatorMemberEntry, myMember]);

      // 4. Vai all'onboarding (che vedrà isPartner=true e farà solo lo step Reddito)
      navigate('/onboarding');
    } catch (e) {
      console.error('[join] configure-account failed:', e);
      setError('Errore di configurazione. Riprova.');
      setJoining(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !familyId || !profile) return;

    if (user.uid === familyId) {
      setError('Non puoi unirti al tuo stesso gruppo!');
      return;
    }

    if (profile.familyId && profile.familyId !== user.uid) {
      setError('Sei già parte di un altro gruppo.');
      return;
    }

    setJoining(true);
    setError('');
    try {
      const partnerMember: FamilyMember = {
        uid: user.uid,
        name: user.displayName ?? 'Partner',
        color: PARTNER_COLOR,
      };

      // 1. Aggiungi me ai membri del creatore
      const creatorSnap = await getDoc(doc(db, 'users', familyId));
      if (creatorSnap.exists()) {
        const creatorProfile = creatorSnap.data() as UserProfile;
        const existing = creatorProfile.familyMembers ?? [];
        const already = existing.some(m => m.uid === user.uid);
        const updatedMembers: FamilyMember[] = already
          ? existing
          : [...existing, partnerMember];
        await updateDoc(doc(db, 'users', familyId), { familyMembers: updatedMembers });
      }

      // 2. Aggiorna il mio profilo con familyId e membri
      const creatorMemberEntry: FamilyMember = {
        uid: familyId,
        name: creatorName ?? 'Partner',
        color: MEMBER_BLUE,
      };
      const myMember: FamilyMember = {
        uid: user.uid,
        name: user.displayName ?? 'Partner',
        color: PARTNER_COLOR,
      };

      const updatedProfile: UserProfile = {
        ...profile,
        familyId,
        familyMembers: [creatorMemberEntry, myMember],
      };
      await setDoc(doc(db, 'users', user.uid), updatedProfile);

      setProfile(updatedProfile);
      setFamilyMembers([creatorMemberEntry, myMember]);

      setDone(true);
      setTimeout(() => navigate('/dashboard'), 1800);
    } catch (e) {
      console.error('[join] failed:', e);
      setError('Errore durante l\'adesione. Riprova.');
    } finally {
      setJoining(false);
    }
  };

  // ─── Render states ──────────────────────────────────────────────────────

  // Done: festa e redirect
  if (done) {
    return (
      <Shell>
        <div style={{ fontSize: 72, textAlign: 'center', marginBottom: 12 }}>🎉</div>
        <h1 style={{
          ...H, fontWeight: 800, fontSize: 30, color: INK,
          letterSpacing: '-1px', textAlign: 'center', margin: 0,
        }}>
          Sei nel gruppo!
        </h1>
        <p style={{
          ...SERIF, fontStyle: 'italic', fontSize: 18,
          color: INK_70, textAlign: 'center', margin: '12px 0 0',
        }}>
          Ora vedete insieme le spese di entrambi.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <Wordmark />
        <IconBtn
          onClick={() => navigate('/dashboard')}
          ariaLabel="Torna indietro"
        >
          <ArrowLeft />
        </IconBtn>
      </div>

      {/* Illustrazione: due cerchi */}
      <div style={{
        position: 'relative',
        height: 120,
        margin: '8px auto 20px',
        width: 220,
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: 0,
          transform: 'translateX(-70%)',
          width: 92, height: 92,
          borderRadius: '50%',
          background: LILAC,
          border: `2.5px solid ${INK}`,
          boxShadow: OFFSET(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...H, fontWeight: 800, fontSize: 36, color: INK,
        }}>
          {creatorName ? creatorName.charAt(0).toUpperCase() : '?'}
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: 12,
          transform: 'translateX(-10%)',
          width: 92, height: 92,
          borderRadius: '50%',
          background: MINT,
          border: `2.5px solid ${INK}`,
          boxShadow: OFFSET(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...H, fontWeight: 800, fontSize: 36, color: INK,
        }}>
          {user?.displayName?.charAt(0).toUpperCase() ?? '+'}
        </div>
      </div>

      {/* Titolo */}
      <h1 style={{
        ...H, fontWeight: 800, fontSize: 34, color: INK,
        lineHeight: 1.02, letterSpacing: '-1.2px',
        margin: '0 0 12px', textAlign: 'center',
      }}>
        Sei stato{' '}
        <span style={{
          ...SERIF, fontStyle: 'italic', fontWeight: 400,
          color: CORAL, fontSize: 38,
        }}>invitato!</span>
      </h1>

      <p style={{
        ...B, fontSize: 15, color: INK_70,
        textAlign: 'center', lineHeight: 1.5,
        margin: '0 0 24px',
      }}>
        {loadingCreator ? (
          'Verifico l\'invito…'
        ) : creatorName ? (
          <>
            <strong style={{ color: INK }}>{creatorName}</strong> ti ha invitato a condividere il budget su <strong style={{ color: INK }}>Bilico</strong>.
          </>
        ) : user ? (
          'Accedi per vedere chi ti ha invitato.'
        ) : (
          'Prima accedi, poi unisciti al gruppo.'
        )}
      </p>

      {/* Card benefit */}
      <div style={{
        background: CREAM,
        border: `2.5px solid ${INK}`,
        borderRadius: 20,
        padding: 16,
        boxShadow: OFFSET(),
        marginBottom: 20,
      }}>
        {[
          { emoji: '📊', text: 'Vedete le spese di entrambi in tempo reale' },
          { emoji: '💶', text: 'Categorie e obiettivi già configurati' },
          { emoji: '⚖️', text: 'Budget familiare, non più fogli Excel' },
        ].map(item => (
          <div key={item.emoji} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 0',
          }}>
            <span style={{ fontSize: 22 }}>{item.emoji}</span>
            <span style={{ ...B, fontSize: 14, color: INK, fontWeight: 500 }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: CREAM,
          border: `2.5px solid ${CORAL}`,
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 14,
        }}>
          <p style={{
            ...B, fontSize: 13, color: CORAL,
            fontWeight: 600, margin: 0,
          }}>{error}</p>
        </div>
      )}

      {/* CTA principale — cambia in base allo stato */}
      {authLoading ? (
        <BigButton variant="cream" disabled>Caricamento…</BigButton>
      ) : !user ? (
        <BigButton
          variant="ink"
          onClick={handleSignIn}
          disabled={signing}
        >
          {signing ? 'Accesso in corso…' : 'Accedi con Google per unirti'}
        </BigButton>
      ) : !profile?.onboardingComplete ? (
        <BigButton
          variant="ink"
          onClick={handleConfigureAccount}
          disabled={joining || loadingCreator}
        >
          {joining ? 'Preparo l\'account…' : 'Entra nel gruppo'}
        </BigButton>
      ) : profile.familyId && profile.familyId !== user.uid ? (
        <div style={{
          background: GREEN,
          border: `2.5px solid ${INK}`,
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: OFFSET(),
          textAlign: 'center',
        }}>
          <p style={{
            ...H, fontWeight: 800, fontSize: 15, color: CREAM, margin: 0,
          }}>
            ✓ Sei già in un gruppo famiglia
          </p>
        </div>
      ) : user.uid === familyId ? (
        <div style={{
          background: CREAM,
          border: `2.5px solid ${INK}`,
          borderRadius: 16,
          padding: '14px 18px',
          textAlign: 'center',
        }}>
          <p style={{
            ...SERIF, fontStyle: 'italic', fontSize: 16,
            color: INK_70, margin: 0,
          }}>
            Questo è il tuo stesso gruppo. Condividi il link con chi vuoi invitare.
          </p>
        </div>
      ) : (
        <BigButton
          variant="ink"
          onClick={handleJoin}
          disabled={joining || loadingCreator}
        >
          {joining ? 'Unione in corso…' : 'Unisciti al gruppo'}
        </BigButton>
      )}
    </Shell>
  );
}

// ─── Shell ridotta per le varie fasi ────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}
