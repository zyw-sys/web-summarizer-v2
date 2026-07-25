"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { loadDailyGoal, saveDailyGoal } from "@/lib/goalStorage";
import { summarizeMeals } from "@/lib/mealLog";
import { ACTIVITY_LABELS, calculateGoalKcal } from "@/lib/tdee";
import type { DailyGoalProfile, MealLogItem } from "@/lib/types";

type Props = {
  meals: MealLogItem[];
  loggedIn: boolean;
  exerciseBurned?: number;
  onGoalChange?: (goal: DailyGoalProfile) => void;
};

const fieldClass =
  "w-full rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 text-sm outline-none";

export default function DailyGoalCard({
  meals,
  loggedIn,
  exerciseBurned = 0,
  onGoalChange,
}: Props) {
  const [profile, setProfile] = useState<DailyGoalProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (loggedIn) {
          const response = await fetch("/api/goals");
          if (response.ok) {
            const data = await response.json();
            if (!cancelled) {
              setProfile(data.goal);
              onGoalChange?.(data.goal);
            }
            return;
          }
        }
        const local = loadDailyGoal();
        if (!cancelled) {
          setProfile(local);
          onGoalChange?.(local);
        }
      } catch {
        if (!cancelled) {
          const local = loadDailyGoal();
          setProfile(local);
          onGoalChange?.(local);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  if (!profile) return null;

  const summary = summarizeMeals(meals);
  const netIntake = Math.max(0, summary.calories - exerciseBurned);
  const progress = Math.min(
    100,
    (netIntake / Math.max(profile.goalKcal, 1)) * 100,
  );
  const remaining = Math.max(0, profile.goalKcal - netIntake);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const next: DailyGoalProfile = {
      gender: form.get("gender") === "female" ? "female" : "male",
      age: Number(form.get("age")),
      heightCm: Number(form.get("heightCm")),
      weightKg: Number(form.get("weightKg")),
      activity:
        (form.get("activity") as DailyGoalProfile["activity"]) || "light",
      goalKcal: 0,
    };
    next.goalKcal = calculateGoalKcal(next);

    try {
      if (loggedIn) {
        const response = await fetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "保存失败");
        }
        setProfile(data.goal);
        onGoalChange?.(data.goal);
      } else {
        saveDailyGoal(next);
        setProfile(next);
        onGoalChange?.(next);
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">今日目标</p>
          <p
            className="mt-1 text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {netIntake}
            <span className="text-base text-[var(--muted)]">
              {" "}
              / {profile.goalKcal} kcal
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            饮食 {summary.calories} · 运动 -{exerciseBurned} · 还可约{" "}
            {remaining} kcal
            {loggedIn ? " · 已同步" : " · 本机临时"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ border: "1px solid var(--line)" }}
        >
          {open ? "收起" : "设置目标"}
        </button>
      </div>

      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full"
        style={{ background: "rgba(28,43,34,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress}%`,
            background: progress >= 100 ? "var(--warm)" : "var(--accent)",
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="蛋白质" value={`${Math.round(summary.protein)} g`} />
        <Stat label="脂肪" value={`${Math.round(summary.fat)} g`} />
        <Stat label="碳水" value={`${Math.round(summary.carbs)} g`} />
      </div>

      {open && (
        <form
          onSubmit={handleSave}
          className="mt-5 space-y-3 border-t border-[var(--line)] pt-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="性别">
              <select
                name="gender"
                defaultValue={profile.gender}
                className={fieldClass}
              >
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </Field>
            <Field label="年龄">
              <input
                name="age"
                type="number"
                min={10}
                max={100}
                defaultValue={profile.age}
                className={fieldClass}
                required
              />
            </Field>
            <Field label="身高 cm">
              <input
                name="heightCm"
                type="number"
                min={100}
                max={250}
                defaultValue={profile.heightCm}
                className={fieldClass}
                required
              />
            </Field>
            <Field label="体重 kg">
              <input
                name="weightKg"
                type="number"
                min={30}
                max={250}
                step="0.1"
                defaultValue={profile.weightKg}
                className={fieldClass}
                required
              />
            </Field>
          </div>
          <Field label="活动量">
            <select
              name="activity"
              defaultValue={profile.activity}
              className={fieldClass}
            >
              {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {error && (
            <p className="text-xs" style={{ color: "var(--warm)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent-deep)" }}
          >
            {saving ? "保存中…" : "保存并重算目标"}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-[var(--muted)]">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-2 py-3"
      style={{ background: "rgba(28,43,34,0.04)" }}
    >
      <p className="text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
