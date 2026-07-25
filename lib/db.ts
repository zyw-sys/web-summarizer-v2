import { mkdirSync } from "fs";
import { join } from "path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "@/lib/password";

const globalForDb = globalThis as unknown as {
  __kazhiDb?: DatabaseSync;
};

function columnExists(db: DatabaseSync, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === column);
}

function ensureRoleColumn(db: DatabaseSync) {
  if (!columnExists(db, "users", "role")) {
    db.exec(
      `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`,
    );
  }
}

function seedSuperAdmin(db: DatabaseSync) {
  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  const password = process.env.ADMIN_PASSWORD || "admin123456";

  const existing = db
    .prepare(
      `SELECT id, role FROM users WHERE username = ? COLLATE NOCASE`,
    )
    .get(username) as { id: number; role: string } | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`,
    ).run(username, hashPassword(password));
    console.info(`[db] seeded super admin: ${username}`);
    return;
  }

  if (existing.role !== "admin") {
    db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(
      existing.id,
    );
    console.info(`[db] promoted user to super admin: ${username}`);
  }
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      ip TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      session_id TEXT,
      event TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      message TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS meal_logs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      name TEXT NOT NULL,
      grams REAL NOT NULL,
      calories REAL NOT NULL,
      protein REAL,
      fat REAL,
      carbs REAL,
      slot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_goals (
      user_id INTEGER PRIMARY KEY,
      gender TEXT NOT NULL,
      age INTEGER NOT NULL,
      height_cm REAL NOT NULL,
      weight_kg REAL NOT NULL,
      activity TEXT NOT NULL,
      goal_kcal INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercise_logs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      name TEXT NOT NULL,
      duration_min REAL NOT NULL,
      calories REAL NOT NULL,
      met REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, day),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_meal_logs_user_day ON meal_logs(user_id, day);
    CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_day ON exercise_logs(user_id, day);
    CREATE INDEX IF NOT EXISTS idx_weight_logs_user_day ON weight_logs(user_id, day);
  `);

  ensureRoleColumn(db);
  seedSuperAdmin(db);
}

export function getDb(): DatabaseSync {
  if (globalForDb.__kazhiDb) {
    return globalForDb.__kazhiDb;
  }

  const dataDir = join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "kazhi.sqlite");

  const db = new DatabaseSync(dbPath);
  initSchema(db);
  globalForDb.__kazhiDb = db;
  return db;
}
