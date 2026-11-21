import type { FastifyRequest } from 'fastify';

import { env } from '../config/env.js';
import { getFirebaseAuth } from '../config/firebase.js';
import { UnauthorizedError } from '../shared/errors/app-error.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function authenticate(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;

  if (env.USE_IN_MEMORY_DB) {
    const devUid = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim() || 'dev-user-1'
      : 'dev-user-1';
    request.user = {
      uid: devUid,
      email: 'dev@shopego.local',
    };
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de autenticação ausente');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Token de autenticação inválido');
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    request.user = {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    throw new UnauthorizedError('Token expirado ou inválido');
  }
}
