import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Wir erweitern das Request Objekt, damit TypeScript "req.user" kennt
export interface AuthRequest extends Request {
  user?: { id: number; username: string };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  // Token kommt meist als "Bearer EYY123..."
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401); // Kein Token -> Unauthorized

  jwt.verify(token, 'SECRET_KEY_HIER_AENDERN', (err: any, user: any) => {
    if (err) return res.sendStatus(403); // Token ungültig -> Forbidden
    req.user = user;
    next();
  });
};