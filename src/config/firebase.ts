import fs from 'node:fs';
import path from 'node:path';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { env } from './env.js';

function createFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolvedPath = path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
      return initializeApp({
        credential: cert(serviceAccount),
      });
    }
  }

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  throw new Error(
    'Credenciais do Firebase Admin não configuradas. Defina FIREBASE_SERVICE_ACCOUNT_PATH ou FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY no .env.',
  );
}

let cachedApp: App | null = null;

function getFirebaseApp(): App {
  if (!cachedApp) {
    cachedApp = createFirebaseApp();
  }
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
