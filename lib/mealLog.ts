import type { MealLogItem, MealSlot } from "@/lib/types";

const STORAGE_KEY = "kazhi-meal-log-v1";

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type StoredShape = {
  date: string;
  items: MealLogItem[];
};

function readStore(): StoredShape {
  if (typeof window === "undefined") {
    return { date: todayKey(), items: [] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayKey(), items: [] };
    const parsed = JSON.parse(raw) as StoredShape;
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), items: [] };
    }
    return {
      date: parsed.date,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { date: todayKey(), items: [] };
  }
}

function writeStore(items: MealLogItem[]) {
  if (typeof window === "undefined") return;
  const payload: StoredShape = { date: todayKey(), items };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadTodayMeals(): MealLogItem[] {
  return readStore().items;
}

export function addMealItem(
  item: Omit<MealLogItem, "id" | "addedAt">,
): MealLogItem[] {
  const next: MealLogItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: new Date().toISOString(),
  };
  const items = [...readStore().items, next];
  writeStore(items);
  return items;
}

export function removeMealItem(id: string): MealLogItem[] {
  const items = readStore().items.filter((item) => item.id !== id);
  writeStore(items);
  return items;
}

export function clearTodayMeals(): MealLogItem[] {
  writeStore([]);
  return [];
}

export function summarizeMeals(items: MealLogItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.calories += item.calories;
      acc.protein += item.protein ?? 0;
      acc.fat += item.fat ?? 0;
      acc.carbs += item.carbs ?? 0;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

export function suggestMealSlot(now = new Date()): MealSlot {
  const hour = now.getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}
