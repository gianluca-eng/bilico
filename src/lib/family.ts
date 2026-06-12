// ─── Gestione collezione `families/` ────────────────────────────────────────
// Directory CONDIVISA della famiglia: contiene SOLO dati non sensibili
// (nomi, colori, uid dei membri). NON contiene reddito, spese o transazioni.
// Serve per il flusso di invito e per mostrare i membri nella UI.
//
// I dati finanziari restano in `users/{uid}`, leggibili SOLO dal proprietario.
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { FamilyMember } from '../types';

const CREATOR_COLOR = '#2D6BE4';
const PARTNER_COLOR = '#EA580C';

export interface FamilyDoc {
  creatorName: string;
  members: FamilyMember[];   // {uid, name, color}
  memberUids: string[];      // lista piatta di uid (usata dalle Firestore rules)
  createdAt?: unknown;       // serverTimestamp
}

/**
 * Crea (o sovrascrive) il documento famiglia per un creatore.
 * Chiamata durante l'onboarding del creatore.
 */
export async function createFamilyDoc(
  familyId: string,
  creatorName: string,
): Promise<void> {
  const members: FamilyMember[] = [
    { uid: familyId, name: creatorName, color: CREATOR_COLOR },
  ];
  const data: FamilyDoc = {
    creatorName,
    members,
    memberUids: [familyId],
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'families', familyId), data, { merge: true });
}

/**
 * Aggiunge un partner al documento famiglia.
 * Idempotente: se l'uid è già presente, non duplica.
 * Rispetta le Firestore rules: aggiunge esattamente se stesso a memberUids.
 */
export async function addMemberToFamily(
  familyId: string,
  member: FamilyMember,
): Promise<void> {
  const ref = doc(db, 'families', familyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Famiglia non trovata.');
  }
  const data = snap.data() as FamilyDoc;
  if (data.memberUids.includes(member.uid)) {
    return; // già membro
  }
  await updateDoc(ref, {
    members: [...data.members, { ...member, color: PARTNER_COLOR }],
    memberUids: [...data.memberUids, member.uid],
  });
}

/** Legge una volta il documento famiglia. */
export async function getFamilyDoc(familyId: string): Promise<FamilyDoc | null> {
  const snap = await getDoc(doc(db, 'families', familyId));
  return snap.exists() ? (snap.data() as FamilyDoc) : null;
}

/**
 * Sottoscrive in tempo reale al documento famiglia.
 * Ritorna la funzione di unsubscribe.
 */
export function subscribeFamilyDoc(
  familyId: string,
  onChange: (fam: FamilyDoc | null) => void,
  onError?: (err: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'families', familyId),
    (snap) => onChange(snap.exists() ? (snap.data() as FamilyDoc) : null),
    (err) => onError?.(err),
  );
}

/** Normalizza i colori dei membri (creatore blu, partner arancione). */
export function membersWithColors(
  members: FamilyMember[],
  familyId: string,
): FamilyMember[] {
  return members.map(m => ({
    ...m,
    color: m.uid === familyId ? CREATOR_COLOR : PARTNER_COLOR,
  }));
}
