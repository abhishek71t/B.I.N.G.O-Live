import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID',
};

export function isFirebaseConfigured(): boolean {
  const { apiKey, databaseURL, projectId } = firebaseConfig;
  if (!apiKey || !databaseURL || !projectId) return false;
  if (
    apiKey.includes('YOUR_') ||
    databaseURL.includes('YOUR_') ||
    projectId.includes('YOUR_')
  ) {
    return false;
  }
  return databaseURL.startsWith('https://');
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
  } catch (err) {
    console.warn('Firebase init fallback:', err);
  }
}

export { app, auth, db };

export async function ensureAnonymousUser(): Promise<string> {
  if (auth && isFirebaseConfigured()) {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth!,
        async (user) => {
          unsubscribe();
          if (user) {
            localStorage.setItem('bingo_uid', user.uid);
            resolve(user.uid);
          } else {
            try {
              const cred = await signInAnonymously(auth!);
              localStorage.setItem('bingo_uid', cred.user.uid);
              resolve(cred.user.uid);
            } catch (err) {
              reject(err);
            }
          }
        },
        reject
      );
    });
  }

  // Persistent unique UID per session/tab for reliable multi-tab & multi-device testing
  let sessionUid = sessionStorage.getItem('bingo_tab_uid');
  if (!sessionUid) {
    const existingLocal = localStorage.getItem('bingo_uid');
    const activeTabCheck = localStorage.getItem('bingo_active_tab_heartbeat');
    const now = Date.now();
    if (existingLocal && (!activeTabCheck || now - Number(activeTabCheck) > 4000)) {
      sessionUid = existingLocal;
    } else {
      sessionUid =
        'uid_' +
        Math.random().toString(36).substring(2, 9) +
        '_' +
        Date.now().toString(36).slice(-4);
    }
    sessionStorage.setItem('bingo_tab_uid', sessionUid);
    if (!existingLocal) {
      localStorage.setItem('bingo_uid', sessionUid);
    }
  }
  return sessionUid;
}
