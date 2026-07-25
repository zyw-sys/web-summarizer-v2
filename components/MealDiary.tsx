"use client";

import { MEAL_SLOT_LABELS } from "@/lib/mealLog";
import type { MealLogItem } from "@/lib/types";

type Props = {
  meals: MealLogItem[];
  loggedIn: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export default function MealDiary({
  meals,
  loggedIn,
  onRemove,
  onClear,
}: Props) {
  if (meals.length === 0) {
    return (
      <section
        className="rounded-2xl px-5 py-6 text-sm text-[var(--muted)]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        今日饮食日记为空。
        {loggedIn
          ? "查询食物后可「加入今日饮食」。"
          : "登录后可按账号区分保存；未登录仅临时保存在本机。"}
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <div>
          <h3
            className="text-lg tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            今日饮食
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {loggedIn ? "已同步到 SQLite 账号数据" : "本机临时数据"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-[var(--muted)]"
        >
          清空今日
        </button>
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {meals.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {MEAL_SLOT_LABELS[item.slot]} · {item.grams}g
                {item.protein != null ? ` · 蛋白 ${item.protein}g` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold" style={{ color: "var(--accent)" }}>
                {item.calories} kcal
              </p>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="mt-1 text-xs text-[var(--muted)]"
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
