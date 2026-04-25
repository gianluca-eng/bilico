import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithCredential, GoogleAuthProvider, getRedirectResult, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, googleProvider, db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { migrateSharedFlags } from '../lib/sharing';
import type { User, UserProfile, FamilyMember } from '../types';

const PARTNER_COLOR = '#EA580C'; // arancione per il partner
const CREATOR_COLOR = '#2D6BE4'; // blu per il creatore

export function useAuth() {
  const {
    user, setUser, setAuthLoading, setProfile, setFamilyMembers,
    setTransactions, setBudgets, setFamily,
  } = useStore();

  useEffect(() => {
    // Gestisce il risultato del redirect Google (su mobile)
    getRedirectResult(auth)
      .then(result => {
        if (result?.user) {
          console.log('[auth] redirect result received:', result.user.uid);
        }
      })
      .catch(err => console.warn('[auth] redirect result error:', err));

    // Fallback: se Firebase non risponde entro 5s, sblocca comunque l'app
    const timeout = setTimeout(() => setAuthLoading(false), 5000);

    // Sottoscrizione al profilo Firestore: oltre al primo load,
    // questo riceve anche gli update da altri membri famiglia
    // (es. quando il partner si unisce e si aggiunge ai familyMembers)
    let profileUnsub: (() => void) | null = null;
    let migrationDoneFor: string | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeout);
      console.log('[auth] onAuthStateChanged fired, user:', firebaseUser?.uid ?? 'null');

      // Pulizia eventuale subscription precedente (logout o cambio account)
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
        migrationDoneFor = null;
      }

      if (!firebaseUser) {
        // Pulizia totale alla disconnessione per evitare che dati
        // del precedente account leggano a quello nuovo.
        setUser(null);
        setProfile(null);
        setFamilyMembers([]);
        setTransactions([]);
        setBudgets([]);
        setFamily(null);
        setAuthLoading(false);
        return;
      }

      const u: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      };
      setUser(u);

      profileUnsub = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        async (snap) => {
          let profile = snap.exists() ? (snap.data() as UserProfile) : null;

          // Migration runtime: applica flag `shared` ai profili legacy.
          // Eseguita una sola volta per uid per evitare loop di scrittura.
          if (profile && migrationDoneFor !== firebaseUser.uid) {
            const migrated = migrateSharedFlags(profile);
            if (migrated) {
              profile = migrated;
              migrationDoneFor = firebaseUser.uid;
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), migrated);
                console.log('[auth] migrated shared flags for', firebaseUser.uid);
              } catch (err) {
                console.warn('[auth] shared flags migration write failed:', err);
              }
            } else {
              migrationDoneFor = firebaseUser.uid;
            }
          }

          setProfile(profile);

          // Carica i membri della famiglia se esiste un familyId
          if (profile?.familyId) {
            const members: FamilyMember[] = profile.familyMembers ?? [];
            const withColors = members.map(m => ({
              ...m,
              color: m.uid === profile.familyId ? CREATOR_COLOR : PARTNER_COLOR,
            }));
            setFamilyMembers(withColors);
          } else {
            setFamilyMembers([]);
          }

          setAuthLoading(false);
        },
        (err) => {
          console.warn('[auth] profile snapshot error:', err);
          setProfile(null);
          setFamilyMembers([]);
          setAuthLoading(false);
        },
      );
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, [
    setUser, setAuthLoading, setProfile, setFamilyMembers,
    setTransactions, setBudgets, setFamily,
  ]);

  const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      // Login nativo (Android/iOS): usa il selettore di account del sistema
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error('Google idToken mancante');
      const credential = GoogleAuthProvider.credential(idToken);
      return signInWithCredential(auth, credential);
    }
    // Login web: popup Google standard
    return signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut();
    }
    return signOut(auth);
  };

  return { user, signInWithGoogle, logout };
}
