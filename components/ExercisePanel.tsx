"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  EXERCISE_PRESETS,
  estimateExerciseCalories,
} from "@/lib/exercises";
import type { ExerciseLogItem } from "@/lib/types";

type Props = {
  weightKg: number;
  onBurnedChange?: (burned: number) => void;
};

export default function ExercisePanel({ weightKg, onBurnedChange }: Props) {
  const [exercises, setExercises] = useState<ExerciseLogItem[]>([]);
  const [name, setName] = useState(EXERCISE_PRESETS[0].name);
  const [met, setMet] = useState(EXERCISE_PRESETS[0].met);
  const [durationMin, setDurationMin] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () => estimateExerciseCalories(met, weightKg, durationMin),
    [met, weightKg, durationMin],
  );

  const burned = exercises.reduce((sum, item) => sum + item.calories, 0);

  async function refresh() {
    const response = await fetch("/api/exercises");
    const data = await response.json();
    if (response.ok) {
      setExercises(data.exercises ?? []);
      onBurnedChange?.(data.burned ?? 0);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onBurnedChange?.(burned);
  }, [burned, onBurnedChange]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, durationMin, met }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "添加失败");
      setExercises(data.exercises ?? []);
      onBurnedChange?.(data.burned ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    const response = await fetch(
      `/api/exercises?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    if (response.ok) {
      setExercises(data.exercises ?? []);
      onBurnedChange?.(data.burned ?? 0);
    }
  }

  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl p-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <p className="text-sm text-[var(--muted)]">今日运动消耗</p>
        <p
          className="mt-1 text-3xl font-semibold"
          style={{
            fontFamily: "var(--font-display), serif",
            color: "var(--accent)",
          }}
        >
          {burned}{" "}
          <span className="text-base font-medium text-[var(--muted)]">kcal</span>
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          按当前体重 {weightKg} kg 与 MET 估算
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        <p
          className="text-lg tracking-tight"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          记录运动
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXERCISE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setName(preset.name);
                setMet(preset.met);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                border: "1px solid var(--line)",
                background:
                  name === preset.name
                    ? "rgba(47,107,79,0.12)"
                    : "transparent",
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-[var(--muted)]">
            运动名称
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 text-sm outline-none"
              required
            />
          </label>
          <label className="text-xs text-[var(--muted)]">
            时长（分钟）
            <input
              type="number"
              min={1}
              max={600}
              value={durationMin}
              onChange={(e) =>
                setDurationMin(Math.max(1, Number(e.target.value) || 1))
              }
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 text-sm outline-none"
              required
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          预估消耗约{" "}
          <span className="font-semibold" style={{ color: "var(--accent)" }}>
            {preview} kcal
          </span>
          （MET {met}）
        </p>
        {error && (
          <p className="mt-2 text-xs" style={{ color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent-deep)" }}
        >
          {loading ? "保存中…" : "添加运动记录"}
        </button>
      </form>

      <section
        className="overflow-hidden rounded-2xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h3
            className="text-lg tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            今日运动列表
          </h3>
        </div>
        {exercises.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)]">
            还没有运动记录，先添加一笔吧。
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {exercises.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.durationMin} 分钟
                    {item.met != null ? ` · MET ${item.met}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold" style={{ color: "var(--accent)" }}>
                    {item.calories} kcal
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="mt-1 text-xs text-[var(--muted)]"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
