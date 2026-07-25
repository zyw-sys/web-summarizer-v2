"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export type AuthUser = {
  id: number;
  username: string;
  role?: "user" | "admin";
  createdAt: string;
};

export type LoginLogItem = {
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

type Props = {
  onAuthChange: (user: AuthUser | null) => void;
  onReady?: () => void;
};

const EVENT_LABEL: Record<string, string> = {
  register: "注册登录",
  login: "登录",
  logout: "退出",
  login_failed: "登录失败",
};

export default function AuthPanel({ onAuthChange, onReady }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [logs, setLogs] = useState<LoginLogItem[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [booting, setBooting] = useState(true);

  async function refreshMe() {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    setUser(data.user ?? null);
    setLogs(data.loginLogs ?? []);
    onAuthChange(data.user ?? null);
  }

  useEffect(() => {
    refreshMe()
      .catch(() => onAuthChange(null))
      .finally(() => {
        setBooting(false);
        onReady?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "操作失败");
      }
      setPassword("");
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setLogs([]);
      onAuthChange(null);
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return (
      <section
        className="rounded-2xl px-5 py-4 text-sm text-[var(--muted)]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        正在读取登录状态…
      </section>
    );
  }

  if (user) {
    return (
      <section
        className="animate-rise rounded-2xl p-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">当前用户</p>
            <p
              className="mt-1 text-2xl tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {user.username}
              {user.role === "admin" && (
                <span
                  className="ml-2 align-middle text-xs font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  超级管理员
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              饮食日记与目标已按账号区分，保存在 SQLite
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role === "admin" && (
              <>
                <Link
                  href="/admin"
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  监察台
                </Link>
                <button
                  type="button"
                  onClick={() => setShowLogs((v) => !v)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ border: "1px solid var(--line)" }}
                >
                  {showLogs ? "收起记录" : "登录记录"}
                </button>
              </>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={handleLogout}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent-deep)" }}
            >
              退出
            </button>
          </div>
        </div>

        {user.role === "admin" && showLogs && (
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <p
              className="mb-3 text-sm tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              最近登录记录
            </p>
            {logs.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">暂无记录</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-xl px-3 py-2.5 text-xs"
                    style={{ background: "rgba(28,43,34,0.04)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {EVENT_LABEL[log.event] || log.event}
                        {!log.success ? "（失败）" : ""}
                      </span>
                      <span className="text-[var(--muted)]">
                        {formatTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--muted)]">
                      {log.message || "—"}
                      {log.ip ? ` · IP ${log.ip}` : ""}
                    </p>
                    {log.sessionId && (
                      <p className="mt-1 truncate text-[10px] text-[var(--muted)]">
                        会话：{log.sessionId}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className="animate-rise rounded-2xl p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p
            className="text-lg tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {mode === "login" ? "登录账号" : "注册账号"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            登录后可区分用户数据，并记录每次登录
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "login" ? "register" : "login"));
            setError(null);
            setShowPassword(false);
          }}
          className="text-xs font-semibold"
          style={{ color: "var(--accent)" }}
        >
          {mode === "login" ? "去注册" : "去登录"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名"
          autoComplete="username"
          className="w-full rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 text-sm outline-none"
          required
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "密码（至少 6 位）" : "密码"}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            className="w-full rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 pr-11 text-sm outline-none"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            title={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {error && (
          <p className="text-xs" style={{ color: "var(--warm)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent-deep)" }}
        >
          {loading ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>
    </section>
  );
}

function formatTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.4 5.5A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-4.1 4.6M6.1 6.2A17.5 17.5 0 0 0 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
