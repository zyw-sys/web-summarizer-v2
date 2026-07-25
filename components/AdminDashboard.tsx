"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/components/AuthPanel";
import { MEAL_SLOT_LABELS } from "@/lib/mealLog";
import { ACTIVITY_LABELS } from "@/lib/tdee";

type Overview = {
  userCount: number;
  adminCount: number;
  loginSuccessToday: number;
  loginFailedToday: number;
  mealCountToday: number;
  activeSessions: number;
};

type UserRow = {
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

type LoginLog = {
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

type UserDetail = {
  user: {
    id: number;
    username: string;
    role: "user" | "admin";
    createdAt: string;
  };
  goal: {
    gender: string;
    age: number;
    heightCm: number;
    weightKg: number;
    activity: keyof typeof ACTIVITY_LABELS;
    goalKcal: number;
  } | null;
  meals: Array<{
    id: string;
    name: string;
    grams: number;
    calories: number;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    slot: keyof typeof MEAL_SLOT_LABELS;
    day: string;
    addedAt: string;
  }>;
  loginLogs: LoginLog[];
};

const EVENT_LABEL: Record<string, string> = {
  register: "注册",
  login: "登录",
  logout: "退出",
  login_failed: "登录失败",
};

export default function AdminDashboard() {
  const [booting, setBooting] = useState(true);
  const [admin, setAdmin] = useState<AuthUser | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadBoard = useCallback(async () => {
    setError(null);
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    const current = meData.user as AuthUser | null;
    setAdmin(current);

    if (!current || current.role !== "admin") {
      setBooting(false);
      return;
    }

    const [overviewRes, usersRes, logsRes] = await Promise.all([
      fetch("/api/admin/overview"),
      fetch("/api/admin/users"),
      fetch("/api/admin/login-logs"),
    ]);

    if (!overviewRes.ok || !usersRes.ok || !logsRes.ok) {
      setError("加载监察数据失败，请确认管理员权限");
      setBooting(false);
      return;
    }

    const overviewData = await overviewRes.json();
    const usersData = await usersRes.json();
    const logsData = await logsRes.json();
    setOverview(overviewData.overview);
    setUsers(usersData.users ?? []);
    setLogs(logsData.logs ?? []);
    setBooting(false);
  }, []);

  useEffect(() => {
    loadBoard().catch(() => {
      setError("无法加载监察台");
      setBooting(false);
    });
  }, [loadBoard]);

  async function openUser(id: number) {
    setSelectedId(id);
    setLoadingDetail(true);
    setDetail(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "加载用户详情失败");
      }
      setDetail(data as UserDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载用户详情失败");
    } finally {
      setLoadingDetail(false);
    }
  }

  if (booting) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-5">
        <p className="text-sm text-[var(--muted)]">正在加载监察台…</p>
      </main>
    );
  }

  if (!admin || admin.role !== "admin") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-16">
        <section
          className="rounded-2xl p-8 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            无访问权限
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            监察台仅超级管理员可进入。请使用管理员账号登录。
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--accent-deep)" }}
          >
            返回首页登录
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto min-h-screen w-full max-w-5xl px-5 py-10 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className="text-sm font-semibold tracking-[0.18em] uppercase"
            style={{ color: "var(--accent)" }}
          >
            卡知 · 监察台
          </p>
          <h1
            className="mt-2 text-4xl tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            超级管理员
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            当前：{admin.username} · 可查看用户登录与饮食数据
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadBoard()}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--line)" }}
          >
            刷新
          </button>
          <Link
            href="/"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent-deep)" }}
          >
            返回前台
          </Link>
        </div>
      </header>

      {error && (
        <div
          className="mb-5 rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "rgba(196,105,58,0.1)",
            color: "var(--warm)",
            border: "1px solid rgba(196,105,58,0.28)",
          }}
        >
          {error}
        </div>
      )}

      {overview && (
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="普通用户" value={String(overview.userCount)} />
          <StatCard label="管理员" value={String(overview.adminCount)} />
          <StatCard
            label="今日成功登录"
            value={String(overview.loginSuccessToday)}
          />
          <StatCard
            label="今日失败登录"
            value={String(overview.loginFailedToday)}
          />
          <StatCard
            label="今日饮食条数"
            value={String(overview.mealCountToday)}
          />
          <StatCard
            label="活跃会话"
            value={String(overview.activeSessions)}
          />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section
          className="overflow-hidden rounded-2xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2
              className="text-xl tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              用户列表
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              点击用户查看饮食与登录详情
            </p>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {users.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openUser(item.id)}
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-black/[0.03]"
                  style={{
                    background:
                      selectedId === item.id
                        ? "rgba(47,107,79,0.08)"
                        : "transparent",
                  }}
                >
                  <div>
                    <p className="font-semibold">
                      {item.username}
                      {item.role === "admin" && (
                        <span
                          className="ml-2 text-xs font-medium"
                          style={{ color: "var(--accent)" }}
                        >
                          管理员
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      登录 {item.loginCount} 次 · 饮食 {item.mealCount} 条 ·
                      今日 {item.todayCalories} kcal
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      最近登录：{formatTime(item.lastLoginAt) || "暂无"}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    会话 {item.activeSessions}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="overflow-hidden rounded-2xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2
              className="text-xl tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              用户详情
            </h2>
          </div>
          <div className="px-5 py-5">
            {!selectedId && (
              <p className="text-sm text-[var(--muted)]">
                从左侧选择一位用户开始监察。
              </p>
            )}
            {loadingDetail && (
              <p className="text-sm text-[var(--muted)]">加载详情中…</p>
            )}
            {detail && !loadingDetail && (
              <div className="space-y-5">
                <div>
                  <p
                    className="text-2xl tracking-tight"
                    style={{ fontFamily: "var(--font-display), serif" }}
                  >
                    {detail.user.username}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    ID {detail.user.id} · 角色 {detail.user.role} · 注册于{" "}
                    {formatTime(detail.user.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold">每日目标</p>
                  {detail.goal ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {detail.goal.goalKcal} kcal · {detail.goal.gender === "female" ? "女" : "男"} ·{" "}
                      {detail.goal.age} 岁 · {detail.goal.heightCm}cm /{" "}
                      {detail.goal.weightKg}kg ·{" "}
                      {ACTIVITY_LABELS[detail.goal.activity] || detail.goal.activity}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">尚未设置</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold">近期饮食</p>
                  {detail.meals.length === 0 ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">暂无记录</p>
                  ) : (
                    <ul className="mt-2 max-h-48 space-y-2 overflow-auto">
                      {detail.meals.map((meal) => (
                        <li
                          key={meal.id}
                          className="rounded-xl px-3 py-2 text-xs"
                          style={{ background: "rgba(28,43,34,0.04)" }}
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium">{meal.name}</span>
                            <span style={{ color: "var(--accent)" }}>
                              {meal.calories} kcal
                            </span>
                          </div>
                          <p className="mt-1 text-[var(--muted)]">
                            {meal.day} · {MEAL_SLOT_LABELS[meal.slot]} ·{" "}
                            {meal.grams}g
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold">该用户登录记录</p>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-auto">
                    {detail.loginLogs.map((log) => (
                      <li
                        key={log.id}
                        className="rounded-xl px-3 py-2 text-xs"
                        style={{ background: "rgba(28,43,34,0.04)" }}
                      >
                        <div className="flex justify-between gap-2">
                          <span>
                            {EVENT_LABEL[log.event] || log.event}
                            {!log.success ? "（失败）" : ""}
                          </span>
                          <span className="text-[var(--muted)]">
                            {formatTime(log.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[var(--muted)]">
                          {log.message || "—"}
                          {log.ip ? ` · ${log.ip}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <section
        className="mt-5 overflow-hidden rounded-2xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2
            className="text-xl tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            全站登录流水
          </h2>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <span className="font-medium">
                  {log.username || "未知用户"}
                </span>
                <span className="mx-2 text-[var(--muted)]">·</span>
                <span>
                  {EVENT_LABEL[log.event] || log.event}
                  {!log.success ? "（失败）" : ""}
                </span>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {log.message || "—"}
                  {log.ip ? ` · IP ${log.ip}` : ""}
                </p>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {formatTime(log.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
      }}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p
        className="mt-2 text-2xl font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(
    normalized.endsWith("Z") ? normalized : `${normalized}Z`,
  );
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}
