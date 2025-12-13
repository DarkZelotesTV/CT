import { Request, Response, NextFunction } from 'express';
import { resolveUserFromIdentity, IdentityPayload } from '../utils/identityAuth';

export interface AuthUser {
  id: number;
  fingerprint?: string;
  publicKeyB64?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

function extractIdentity(req: Request): IdentityPayload {
  const headers = req.headers as Record<string, any>;
  return {
    fingerprint: (headers['x-identity-fingerprint'] as string) || (req.body?.fingerprint as string),
    publicKeyB64: (headers['x-identity-publickey'] as string) || (req.body?.publicKey as string) || (req.body?.publicKeyB64 as string),
    displayName: (headers['x-identity-displayname'] as string) || (req.body?.displayName as string) || null,
    serverPassword: (headers['x-server-password'] as string) || (req.body?.serverPassword as string) || null,
    signatureB64: (headers['x-identity-signature'] as string) || (req.body?.signature as string) || null,
    timestamp: headers['x-identity-timestamp'] ? Number(headers['x-identity-timestamp']) : req.body?.timestamp ? Number(req.body.timestamp) : null,
  };
}

export const authenticateRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const identity = extractIdentity(req);
    const { user, fingerprint, publicKeyB64 } = await resolveUserFromIdentity(identity);

    req.user = {
      id: user.id,
      fingerprint,
      publicKeyB64,
    };

    next();
  } catch (err: any) {
    const status = err?.status || 401;
    res.status(status).json({ error: err?.message || 'unauthorized' });
  }
};
