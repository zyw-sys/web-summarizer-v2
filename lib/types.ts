export type MacroNutrients = {
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
};

export type FoodNutrition = {
  fdcId: number;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  dataType?: string;
  source?: "usda" | "ai_estimate";
};

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type MealLogItem = {
  id: string;
  name: string;
  grams: number;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  slot: MealSlot;
  addedAt: string;
};

export type DailyGoalProfile = {
  gender: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goalKcal: number;
};

export type ExerciseLogItem = {
  id: string;
  name: string;
  durationMin: number;
  calories: number;
  met: number | null;
  day: string;
  addedAt: string;
};

export type WeightLogItem = {
  id: string;
  day: string;
  weightKg: number;
  note: string | null;
  addedAt: string;
};

export type DayHistoryItem = {
  day: string;
  intakeKcal: number;
  exerciseKcal: number;
  netKcal: number;
  weightKg: number | null;
  mealCount: number;
  exerciseCount: number;
};
