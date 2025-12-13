import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: number;
  fingerprint?: string;
  publicKeyB64?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'JWT_SECRET missing on server' });

  jwt.verify(token, secret, (err, payload: any) => {
    if (err) return res.sendStatus(403);

    const sub = payload?.sub;
    const id = Number(sub);
    if (!Number.isFinite(id)) return res.sendStatus(403);

    req.user = {
      id,
      fingerprint: payload?.fp,
      publicKeyB64: payload?.pk,
    };

    next();
  });
};
