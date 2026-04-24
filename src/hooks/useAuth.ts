import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithCredential, GoogleAuthProvider, getRedirectResult, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      console.log('[auth] onAuthStateChanged fired, user:', firebaseUser?.uid ?? 'null');
      if (firebaseUser) {
        const u: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(u);

        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          let profile = snap.exists() ? (snap.data() as UserProfile) : null;

          // Migration runtime: applica flag `shared` ai profili legacy.
          if (profile) {
            const migrated = migrateSharedFlags(profile);
            if (migrated) {
              profile = migrated;
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), migrated);
                console.log('[auth] migrated shared flags for', firebaseUser.uid);
              } catch (err) {
                console.warn('[auth] shared flags migration write failed:', err);
              }
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
        } catch (err) {
          console.warn('[auth] profile load failed:', err);
          setProfile(null);
          setFamilyMembers([]);
        }
      } else {
        // Pulizia totale alla disconnessione per evitare che dati
        // del precedente account leggano a quello nuovo.
        setUser(null);
        setProfile(null);
        setFamilyMembers([]);
        setTransactions([]);
        setBudgets([]);
        setFamily(null);
      }
      setAuthLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
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
