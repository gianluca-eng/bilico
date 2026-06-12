import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithCredential, GoogleAuthProvider, getRedirectResult, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, googleProvider, db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { migrateSharedFlags } from '../lib/sharing';
import {
  createFamilyDoc, subscribeFamilyDoc, membersWithColors,
} from '../lib/family';
import type { User, UserProfile } from '../types';

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

    let profileUnsub: (() => void) | null = null;
    let familyUnsub: (() => void) | null = null;
    let migrationDoneFor: string | null = null;
    let familySubscribedFor: string | null = null;

    const cleanupSubs = () => {
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (familyUnsub) { familyUnsub(); familyUnsub = null; }
      migrationDoneFor = null;
      familySubscribedFor = null;
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeout);
      console.log('[auth] onAuthStateChanged fired, user:', firebaseUser?.uid ?? 'null');

      cleanupSubs();

      if (!firebaseUser) {
        // Pulizia totale alla disconnessione.
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

      // ── Sottoscrizione al profilo privato ──
      profileUnsub = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        async (snap) => {
          let profile = snap.exists() ? (snap.data() as UserProfile) : null;

          // Migration runtime: flag `shared` sui profili legacy.
          if (profile && migrationDoneFor !== firebaseUser.uid) {
            migrationDoneFor = firebaseUser.uid;
            const migrated = migrateSharedFlags(profile);
            if (migrated) {
              profile = migrated;
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), migrated);
              } catch (err) {
                console.warn('[auth] shared flags migration failed:', err);
              }
            }
          }

          setProfile(profile);

          // ── Sottoscrizione alla famiglia (directory pubblica) ──
          const fid = profile?.familyId;
          if (fid && familySubscribedFor !== fid) {
            familySubscribedFor = fid;
            if (familyUnsub) familyUnsub();

            // Migration lazy: se il doc famiglia non esiste ancora
            // (utente creato prima dell'introduzione di families/),
            // lo creiamo dai dati legacy del profilo.
            familyUnsub = subscribeFamilyDoc(
              fid,
              async (fam) => {
                if (fam) {
                  setFamilyMembers(membersWithColors(fam.members, fid));
                } else if (fid === firebaseUser.uid) {
                  // Sono il creatore ma il doc famiglia manca: crealo.
                  const legacyName = profile?.familyMembers?.find(m => m.uid === fid)?.name
                    ?? firebaseUser.displayName
                    ?? 'Tu';
                  try {
                    await createFamilyDoc(fid, legacyName);
                  } catch (err) {
                    console.warn('[auth] lazy family create failed:', err);
                  }
                } else {
                  // Sono un partner ma il doc non c'è (creatore non migrato):
                  // mostra almeno i membri legacy dal profilo.
                  if (profile?.familyMembers) {
                    setFamilyMembers(membersWithColors(profile.familyMembers, fid));
                  }
                }
              },
              (err) => console.warn('[auth] family snapshot error:', err),
            );
          } else if (!fid) {
            setFamilyMembers([]);
            familySubscribedFor = null;
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
      cleanupSubs();
    };
  }, [
    setUser, setAuthLoading, setProfile, setFamilyMembers,
    setTransactions, setBudgets, setFamily,
  ]);

  const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      // Login nativo (Android/iOS): selettore account del sistema.
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error('Google idToken mancante');
      const credential = GoogleAuthProvider.credential(idToken);
      return signInWithCredential(auth, credential);
    }
    return signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await FirebaseAuthentication.signOut();
      } catch (err) {
        console.warn('[auth] native signOut failed:', err);
      }
    }
    return signOut(auth);
  };

  return { user, signInWithGoogle, logout };
}
