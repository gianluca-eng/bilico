import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Tutta la config Firebase viene letta da variabili d'ambiente.
// In locale: settare in `.env.local` (gitignorato).
// Su Vercel: già configurato in Project Settings → Environment Variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  // Meglio fallire subito che avere un'app muta in produzione.
  throw new Error(
    'Firebase config mancante: controlla le VITE_FIREBASE_* in .env.local o su Vercel.',
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
// Forza Google a mostrare il selettore di account ad ogni login,
// anche se l'utente è già loggato in un account Google nel browser.
// Utile su dispositivi condivisi e per cambiare account senza fare logout dal SO.
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
