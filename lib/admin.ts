import { getDb } from "@/lib/db";
import type { DailyGoalProfile, MealLogItem, MealSlot } from "@/lib/types";

export type AdminUserRow = {
  id: number;
  username: string;
  role: "user" | "admin";
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  mealCount: number;
  todayCalories: number;
  activeSessions: number;
};

export type AdminOverview = {
  userCount: number;
  adminCount: number;
  loginSuccessToday: number;
  loginFailedToday: number;
  mealCountToday: number;
  activeSessions: number;
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getAdminOverview(): AdminOverview {
  const db = getDb();
  const day = todayKey();

  const userCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'user'`).get() as {
      c: number;
    }
  ).c;

  const adminCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get() as {
      c: number;
    }
  ).c;

  const loginSuccessToday = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM login_logs
         WHERE success = 1
           AND event IN ('login', 'register')
           AND date(created_at) = date(?)`,
      )
      .get(day) as { c: number }
  ).c;

  const loginFailedToday = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM login_logs
         WHERE success = 0 AND date(created_at) = date(?)`,
      )
      .get(day) as { c: number }
  ).c;

  const mealCountToday = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM meal_logs WHERE day = ?`)
      .get(day) as { c: number }
  ).c;

  const activeSessions = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM sessions
         WHERE revoked_at IS NULL AND datetime(expires_at) > datetime('now')`,
      )
      .get() as { c: number }
  ).c;

  return {
    userCount,
    adminCount,
    loginSuccessToday,
    loginFailedToday,
    mealCountToday,
    activeSessions,
  };
}

export function listUsersForAdmin(): AdminUserRow[] {
  const db = getDb();
  const day = todayKey();

  const rows = db
    .prepare(
      `SELECT
         u.id,
         u.username,
         u.role,
         u.created_at,
         (
           SELECT MAX(l.created_at) FROM login_logs l
           WHERE l.user_id = u.id AND l.success = 1 AND l.event IN ('login', 'register')
         ) AS last_login_at,
         (
           SELECT COUNT(*) FROM login_logs l
           WHERE l.user_id = u.id AND l.success = 1 AND l.event IN ('login', 'register')
         ) AS login_count,
         (
           SELECT COUNT(*) FROM meal_logs m WHERE m.user_id = u.id
         ) AS meal_count,
         (
           SELECT COALESCE(SUM(m.calories), 0) FROM meal_logs m
           WHERE m.user_id = u.id AND m.day = ?
         ) AS today_calories,
         (
           SELECT COUNT(*) FROM sessions s
           WHERE s.user_id = u.id
             AND s.revoked_at IS NULL
             AND datetime(s.expires_at) > datetime('now')
         ) AS active_sessions
       FROM users u
       ORDER BY datetime(u.created_at) DESC, u.id DESC`,
    )
    .all(day) as Array<{
    id: number;
    username: string;
    role: "user" | "admin";
    created_at: string;
    last_login_at: string | null;
    login_count: number;
    meal_count: number;
    today_calories: number;
    active_sessions: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
    mealCount: row.meal_count,
    todayCalories: Math.round(row.today_calories),
    activeSessions: row.active_sessions,
  }));
}

export function listAllLoginLogs(limit = 100) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, username, session_id, event, success, message, ip, user_agent, created_at
       FROM login_logs
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
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

export function getUserDetailForAdmin(userId: number) {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, username, role, created_at FROM users WHERE id = ?`,
    )
    .get(userId) as
    | {
        id: number;
        username: string;
        role: "user" | "admin";
        created_at: string;
      }
    | undefined;

  if (!user) return null;

  const goalRow = db
    .prepare(
      `SELECT gender, age, height_cm, weight_kg, activity, goal_kcal
       FROM daily_goals WHERE user_id = ?`,
    )
    .get(userId) as
    | {
        gender: DailyGoalProfile["gender"];
        age: number;
        height_cm: number;
        weight_kg: number;
        activity: DailyGoalProfile["activity"];
        goal_kcal: number;
      }
    | undefined;

  const meals = db
    .prepare(
      `SELECT id, name, grams, calories, protein, fat, carbs, slot, day, created_at
       FROM meal_logs
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT 50`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    grams: number;
    calories: number;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    slot: MealSlot;
    day: string;
    created_at: string;
  }>;

  const loginLogs = listAllLoginLogs(200).filter(
    (log) => log.userId === userId || log.username === user.username,
  );

  const goal: DailyGoalProfile | null = goalRow
    ? {
        gender: goalRow.gender,
        age: goalRow.age,
        heightCm: goalRow.height_cm,
        weightKg: goalRow.weight_kg,
        activity: goalRow.activity,
        goalKcal: goalRow.goal_kcal,
      }
    : null;

  const mealItems: (MealLogItem & { day: string })[] = meals.map((row) => ({
    id: row.id,
    name: row.name,
    grams: row.grams,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    slot: row.slot,
    addedAt: row.created_at,
    day: row.day,
  }));

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
    },
    goal,
    meals: mealItems,
    loginLogs: loginLogs.slice(0, 30),
  };
}
