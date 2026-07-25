import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_COOKIE = "kazhi_session";
const SESSION_DAYS = 14;

export type UserRole = "user" | "admin";

export type AuthUser = {
  id: number;
  username: string;
  role: UserRole;
  createdAt: string;
};

export type LoginLog = {
  id: number;
  userId: number | null;
  username: string | null;
  sessionId: string | null;
  event: string;
  success: boolean;
  message: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type RequestMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function getAdminUsername() {
  return (process.env.ADMIN_USERNAME || "admin").trim();
}

export function createUser(
  username: string,
  password: string,
  role: UserRole = "user",
): AuthUser {
  const db = getDb();
  const normalized = username.trim();
  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, role)
       VALUES (?, ?, ?)
       RETURNING id, username, role, created_at`,
    )
    .get(normalized, hashPassword(password), role) as {
    id: number;
    username: string;
    role: UserRole;
    created_at: string;
  };

  return {
    id: result.id,
    username: result.username,
    role: result.role,
    createdAt: result.created_at,
  };
}

export function findUserByUsername(username: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, username, password_hash, role, created_at
       FROM users WHERE username = ? COLLATE NOCASE`,
    )
    .get(username.trim()) as
    | {
        id: number;
        username: string;
        password_hash: string;
        role: UserRole;
        created_at: string;
      }
    | undefined;
}

export function writeLoginLog(params: {
  userId?: number | null;
  username?: string | null;
  sessionId?: string | null;
  event: "register" | "login" | "logout" | "login_failed";
  success?: boolean;
  message?: string | null;
  meta?: RequestMeta;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO login_logs
      (user_id, username, session_id, event, success, message, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.userId ?? null,
    params.username ?? null,
    params.sessionId ?? null,
    params.event,
    params.success === false ? 0 : 1,
    params.message ?? null,
    params.meta?.ip ?? null,
    params.meta?.userAgent ?? null,
  );
}

export function createSession(
  userId: number,
  meta?: RequestMeta,
): { sessionId: string; expiresAt: string } {
  const db = getDb();
  const sessionId = randomUUID();
  const expiresAt = addDaysIso(SESSION_DAYS);

  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    sessionId,
    userId,
    expiresAt,
    meta?.ip ?? null,
    meta?.userAgent ?? null,
  );

  return { sessionId, expiresAt };
}

export function revokeSession(sessionId: string) {
  const db = getDb();
  db.prepare(
    `UPDATE sessions SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`,
  ).run(sessionId);
}

export async function setSessionCookie(sessionId: string, expiresAt: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const sessionId = await getSessionId();
  if (!sessionId) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.role, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?
         AND s.revoked_at IS NULL
         AND datetime(s.expires_at) > datetime('now')`,
    )
    .get(sessionId) as
    | {
        id: number;
        username: string;
        role: UserRole;
        created_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    role: row.role || "user",
    createdAt: row.created_at,
  };
}

export async function requireAdmin(): Promise<AuthUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export function listLoginLogs(userId: number, limit = 20): LoginLog[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, username, session_id, event, success, message, ip, user_agent, created_at
       FROM login_logs
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT ?`,
    )
    .all(userId, limit) as Array<{
    id: number;
    user_id: number | null;
    username: string | null;
    session_id: string | null;
    event: string;
    success: number;
    message: string | null;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    sessionId: row.session_id,
    event: row.event,
    success: row.success === 1,
    message: row.message,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}

export function authenticateUser(username: string, password: string) {
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    role: user.role || "user",
    createdAt: user.created_at,
  } satisfies AuthUser;
}

export function getRequestMeta(request: Request): RequestMeta {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent };
}
