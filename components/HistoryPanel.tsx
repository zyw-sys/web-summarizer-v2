"use client";

import { FormEvent, useEffect, useState } from "react";
import SimpleChart from "@/components/SimpleChart";
import type { DayHistoryItem, WeightLogItem } from "@/lib/types";

export default function HistoryPanel() {
  const [days, setDays] = useState(14);
  const [history, setHistory] = useState<DayHistoryItem[]>([]);
  const [weights, setWeights] = useState<WeightLogItem[]>([]);
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(nextDays = days) {
    const response = await fetch(`/api/history?days=${nextDays}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "加载历史失败");
    }
    setHistory(data.history ?? []);
    setWeights(data.weights ?? []);
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "加载失败"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeDays(next: number) {
    setDays(next);
    try {
      await refresh(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function handleWeightSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: Number(weightKg),
          note: note.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setWeights(data.weights ?? []);
      setNote("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function removeWeight(id: string) {
    const response = await fetch(
      `/api/weights?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    if (response.ok) {
      setWeights(data.weights ?? []);
      await refresh();
    }
  }

  const short = (day: string) => day.slice(5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[7, 14, 30].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => changeDays(value)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              border: "1px solid var(--line)",
              background:
                days === value ? "var(--accent-deep)" : "var(--surface)",
              color: days === value ? "#fff" : "var(--muted)",
            }}
          >
            近 {value} 天
          </button>
        ))}
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "rgba(196,105,58,0.1)",
            color: "var(--warm)",
          }}
        >
          {error}
        </div>
      )}

      <section
        className="rounded-2xl p-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <h3
          className="text-lg tracking-tight"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          体重曲线
        </h3>
        <div className="mt-4">
          <SimpleChart
            points={weights.map((item) => ({
              label: short(item.day),
              value: item.weightKg,
            }))}
            unit="kg"
            emptyText="还没有体重记录，先称一下吧"
          />
        </div>

        <form onSubmit={handleWeightSubmit} className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--muted)]">
              今日体重 kg
              <input
                type="number"
                step="0.1"
                min={20}
                max={300}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 text-sm outline-none"
                required
              />
            </label>
            <label className="text-xs text-[var(--muted)]">
              备注（可选）
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="如：空腹"
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 text-sm outline-none"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent-deep)" }}
          >
            {loading ? "保存中…" : "记录体重"}
          </button>
        </form>

        {weights.length > 0 && (
          <ul className="mt-4 max-h-40 space-y-2 overflow-auto">
            {[...weights].reverse().map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                style={{ background: "rgba(28,43,34,0.04)" }}
              >
                <span>
                  {item.day} · {item.weightKg} kg
                  {item.note ? ` · ${item.note}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeWeight(item.id)}
                  className="text-[var(--muted)]"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl p-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <h3
          className="text-lg tracking-tight"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          热量净摄入趋势
        </h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          净摄入 = 饮食热量 − 运动消耗
        </p>
        <div className="mt-4">
          <SimpleChart
            points={history.map((item) => ({
              label: short(item.day),
              value: item.netKcal,
            }))}
            color="#3b6d8f"
            unit="kcal"
            emptyText="暂无多日热量数据"
          />
        </div>
      </section>

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
            多日历史明细
          </h3>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {[...history].reverse().map((item) => (
            <li
              key={item.day}
              className="flex items-start justify-between gap-3 px-5 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{item.day}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  饮食 {item.intakeKcal} · 运动 {item.exerciseKcal}
                  {item.weightKg != null ? ` · 体重 ${item.weightKg}kg` : ""}
                </p>
              </div>
              <p
                className="font-semibold"
                style={{ color: "var(--accent)" }}
              >
                净 {item.netKcal}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
