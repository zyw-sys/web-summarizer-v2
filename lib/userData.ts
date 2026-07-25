import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import type {
  DailyGoalProfile,
  DayHistoryItem,
  ExerciseLogItem,
  MealLogItem,
  MealSlot,
  WeightLogItem,
} from "@/lib/types";
import { DEFAULT_GOAL_PROFILE } from "@/lib/tdee";

export function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + delta);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function listTodayMeals(userId: number): MealLogItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, grams, calories, protein, fat, carbs, slot, created_at
       FROM meal_logs
       WHERE user_id = ? AND day = ?
       ORDER BY datetime(created_at) ASC, id ASC`,
    )
    .all(userId, todayKey()) as Array<{
    id: string;
    name: string;
    grams: number;
    calories: number;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    slot: MealSlot;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    grams: row.grams,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    slot: row.slot,
    addedAt: row.created_at,
  }));
}

export function addUserMeal(
  userId: number,
  item: Omit<MealLogItem, "id" | "addedAt">,
): MealLogItem[] {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO meal_logs
      (id, user_id, day, name, grams, calories, protein, fat, carbs, slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    todayKey(),
    item.name,
    item.grams,
    item.calories,
    item.protein,
    item.fat,
    item.carbs,
    item.slot,
  );
  return listTodayMeals(userId);
}

export function removeUserMeal(userId: number, mealId: string): MealLogItem[] {
  const db = getDb();
  db.prepare(`DELETE FROM meal_logs WHERE id = ? AND user_id = ?`).run(
    mealId,
    userId,
  );
  return listTodayMeals(userId);
}

export function clearUserTodayMeals(userId: number): MealLogItem[] {
  const db = getDb();
  db.prepare(`DELETE FROM meal_logs WHERE user_id = ? AND day = ?`).run(
    userId,
    todayKey(),
  );
  return [];
}

export function getUserGoal(userId: number): DailyGoalProfile {
  const db = getDb();
  const row = db
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

  if (!row) return DEFAULT_GOAL_PROFILE;

  return {
    gender: row.gender,
    age: row.age,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activity: row.activity,
    goalKcal: row.goal_kcal,
  };
}

export function saveUserGoal(userId: number, profile: DailyGoalProfile) {
  const db = getDb();
  db.prepare(
    `INSERT INTO daily_goals
      (user_id, gender, age, height_cm, weight_kg, activity, goal_kcal, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       gender = excluded.gender,
       age = excluded.age,
       height_cm = excluded.height_cm,
       weight_kg = excluded.weight_kg,
       activity = excluded.activity,
       goal_kcal = excluded.goal_kcal,
       updated_at = datetime('now')`,
  ).run(
    userId,
    profile.gender,
    profile.age,
    profile.heightCm,
    profile.weightKg,
    profile.activity,
    profile.goalKcal,
  );
}

export function listTodayExercises(userId: number): ExerciseLogItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, duration_min, calories, met, day, created_at
       FROM exercise_logs
       WHERE user_id = ? AND day = ?
       ORDER BY datetime(created_at) ASC`,
    )
    .all(userId, todayKey()) as Array<{
    id: string;
    name: string;
    duration_min: number;
    calories: number;
    met: number | null;
    day: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationMin: row.duration_min,
    calories: row.calories,
    met: row.met,
    day: row.day,
    addedAt: row.created_at,
  }));
}

export function addUserExercise(
  userId: number,
  item: Omit<ExerciseLogItem, "id" | "addedAt" | "day">,
): ExerciseLogItem[] {
  const db = getDb();
  db.prepare(
    `INSERT INTO exercise_logs
      (id, user_id, day, name, duration_min, calories, met)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    userId,
    todayKey(),
    item.name,
    item.durationMin,
    item.calories,
    item.met,
  );
  return listTodayExercises(userId);
}

export function removeUserExercise(
  userId: number,
  exerciseId: string,
): ExerciseLogItem[] {
  const db = getDb();
  db.prepare(`DELETE FROM exercise_logs WHERE id = ? AND user_id = ?`).run(
    exerciseId,
    userId,
  );
  return listTodayExercises(userId);
}

export function listWeightLogs(
  userId: number,
  days = 30,
): WeightLogItem[] {
  const db = getDb();
  const start = shiftDay(todayKey(), -(days - 1));
  const rows = db
    .prepare(
      `SELECT id, day, weight_kg, note, created_at
       FROM weight_logs
       WHERE user_id = ? AND day >= ?
       ORDER BY day ASC`,
    )
    .all(userId, start) as Array<{
    id: string;
    day: string;
    weight_kg: number;
    note: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    day: row.day,
    weightKg: row.weight_kg,
    note: row.note,
    addedAt: row.created_at,
  }));
}

export function upsertUserWeight(
  userId: number,
  weightKg: number,
  day = todayKey(),
  note: string | null = null,
): WeightLogItem[] {
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM weight_logs WHERE user_id = ? AND day = ?`)
    .get(userId, day) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE weight_logs
       SET weight_kg = ?, note = ?, created_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    ).run(weightKg, note, existing.id, userId);
  } else {
    db.prepare(
      `INSERT INTO weight_logs (id, user_id, day, weight_kg, note)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(randomUUID(), userId, day, weightKg, note);
  }

  return listWeightLogs(userId, 30);
}

export function removeUserWeight(userId: number, weightId: string) {
  const db = getDb();
  db.prepare(`DELETE FROM weight_logs WHERE id = ? AND user_id = ?`).run(
    weightId,
    userId,
  );
  return listWeightLogs(userId, 30);
}

export function getDayHistory(userId: number, days = 14): DayHistoryItem[] {
  const db = getDb();
  const end = todayKey();
  const start = shiftDay(end, -(days - 1));

  const mealRows = db
    .prepare(
      `SELECT day, COALESCE(SUM(calories), 0) AS intake, COUNT(*) AS meal_count
       FROM meal_logs
       WHERE user_id = ? AND day >= ? AND day <= ?
       GROUP BY day`,
    )
    .all(userId, start, end) as Array<{
    day: string;
    intake: number;
    meal_count: number;
  }>;

  const exerciseRows = db
    .prepare(
      `SELECT day, COALESCE(SUM(calories), 0) AS burned, COUNT(*) AS exercise_count
       FROM exercise_logs
       WHERE user_id = ? AND day >= ? AND day <= ?
       GROUP BY day`,
    )
    .all(userId, start, end) as Array<{
    day: string;
    burned: number;
    exercise_count: number;
  }>;

  const weightRows = db
    .prepare(
      `SELECT day, weight_kg
       FROM weight_logs
       WHERE user_id = ? AND day >= ? AND day <= ?`,
    )
    .all(userId, start, end) as Array<{ day: string; weight_kg: number }>;

  const mealMap = new Map(mealRows.map((r) => [r.day, r]));
  const exerciseMap = new Map(exerciseRows.map((r) => [r.day, r]));
  const weightMap = new Map(weightRows.map((r) => [r.day, r.weight_kg]));

  const history: DayHistoryItem[] = [];
  for (let i = 0; i < days; i++) {
    const day = shiftDay(start, i);
    const meal = mealMap.get(day);
    const exercise = exerciseMap.get(day);
    const intakeKcal = Math.round(meal?.intake ?? 0);
    const exerciseKcal = Math.round(exercise?.burned ?? 0);
    history.push({
      day,
      intakeKcal,
      exerciseKcal,
      netKcal: intakeKcal - exerciseKcal,
      weightKg: weightMap.get(day) ?? null,
      mealCount: meal?.meal_count ?? 0,
      exerciseCount: exercise?.exercise_count ?? 0,
    });
  }

  return history;
}

export function todayExerciseCalories(userId: number): number {
  return listTodayExercises(userId).reduce((sum, item) => sum + item.calories, 0);
}
