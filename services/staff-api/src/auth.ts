import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Role } from '@epasslist/shared';

export interface AuthPayload { id:string; username:string; fullName:string; role:Role; siteId:string|null; }

declare global { namespace Express { interface Request { user?: AuthPayload } } }

export function signUser(user: AuthPayload) {
  return jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: '12h', issuer:'epasslist-staff-api' });
}

export function requireAuth(req:Request,res:Response,next:NextFunction) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  if (!token) return res.status(401).json({message:'Authentication required.'});
  try { req.user = jwt.verify(token, process.env.JWT_SECRET!, {issuer:'epasslist-staff-api'}) as AuthPayload; next(); }
  catch { return res.status(401).json({message:'Invalid or expired session.'}); }
}

export function requireRoles(...roles:Role[]) {
  return (req:Request,res:Response,next:NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({message:'You do not have permission for this action.'});
    next();
  };
}
