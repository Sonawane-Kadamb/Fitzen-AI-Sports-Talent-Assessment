import { verifyJwt, type JwtPayload } from './jwt.ts';
import { HttpError, type Middleware, type RequestContext } from '../http/router.ts';

/**
 * Bearer-token authentication middleware. Populates `ctx.user` when a valid
 * token is present; leaves it null otherwise. Route handlers decide whether
 * authentication is required via `requireUser`/`requireRole`.
 */
export function authMiddleware(secret: string): Middleware {
  return (ctx: RequestContext) => {
    const header = ctx.headers['authorization'];
    if (!header || Array.isArray(header)) return;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return;
    const result = verifyJwt(match[1]!, secret);
    if (result.ok) ctx.user = result.payload;
  };
}

export function requireUser(ctx: RequestContext): JwtPayload {
  if (!ctx.user) throw new HttpError(401, 'Authentication required');
  return ctx.user;
}

export function requireRole(
  ctx: RequestContext,
  ...roles: Array<JwtPayload['role']>
): JwtPayload {
  const user = requireUser(ctx);
  if (!roles.includes(user.role)) {
    throw new HttpError(403, `Requires role: ${roles.join(' or ')}`);
  }
  return user;
}
