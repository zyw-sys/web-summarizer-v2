"use client";

import {
  FormEvent,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useState,
} from "react";
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
  const over = netIntake > profile.goalKcal;

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
    <section className="animate-rise panel px-5 py-7 sm:px-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="calorie-ring shrink-0"
          style={
            {
              "--progress": progress,
              "--ring-color": over ? "var(--warn)" : "var(--accent)",
            } as CSSProperties
          }
        >
          <div className="px-3 text-center">
            <p className="text-[11px] tracking-[0.14em] text-[var(--muted)] uppercase">
              {over ? "已超出" : "还可摄入"}
            </p>
            <p className="display mt-1 text-3xl font-semibold tracking-tight">
              {over ? netIntake - profile.goalKcal : remaining}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">kcal</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-[var(--muted)]">今日热量预算</p>
              <p className="display mt-1 text-3xl tracking-tight sm:text-4xl">
                {netIntake}
                <span className="ml-2 text-lg text-[var(--muted)]">
                  / {profile.goalKcal}
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                饮食 {summary.calories} · 运动 -{exerciseBurned}
                {loggedIn ? " · 已同步" : " · 本机临时"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="btn-ghost px-3.5 py-2 text-xs"
            >
              {open ? "收起" : "设置目标"}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center sm:text-left">
            <Stat label="蛋白质" value={`${Math.round(summary.protein)} g`} />
            <Stat label="脂肪" value={`${Math.round(summary.fat)} g`} />
            <Stat label="碳水" value={`${Math.round(summary.carbs)} g`} />
          </div>
        </div>
      </div>

      {open && (
        <form
          onSubmit={handleSave}
          className="mt-6 space-y-3 border-t border-[var(--line)] pt-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="性别">
              <select
                name="gender"
                defaultValue={profile.gender}
                className="field"
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
                className="field"
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
                className="field"
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
                className="field"
                required
              />
            </Field>
          </div>
          <Field label="活动量">
            <select
              name="activity"
              defaultValue={profile.activity}
              className="field"
            >
              {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {error && (
            <p className="text-xs" style={{ color: "var(--warn)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full px-4 py-3 text-sm"
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
    <div>
      <p className="text-[11px] tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
