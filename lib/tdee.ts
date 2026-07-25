import type { DailyGoalProfile } from "@/lib/types";

const ACTIVITY_FACTOR: Record<DailyGoalProfile["activity"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<DailyGoalProfile["activity"], string> = {
  sedentary: "久坐少动",
  light: "轻度活动",
  moderate: "中等活动",
  active: "较高活动",
  very_active: "高强度活动",
};

/** Mifflin-St Jeor BMR × 活动系数 */
export function calculateGoalKcal(
  profile: Omit<DailyGoalProfile, "goalKcal">,
): number {
  const { gender, age, heightCm, weightKg, activity } = profile;
  const bmr =
    gender === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  return Math.round(bmr * ACTIVITY_FACTOR[activity]);
}

export const DEFAULT_GOAL_PROFILE: DailyGoalProfile = {
  gender: "male",
  age: 28,
  heightCm: 170,
  weightKg: 65,
  activity: "light",
  goalKcal: 2200,
};

DEFAULT_GOAL_PROFILE.goalKcal = calculateGoalKcal(DEFAULT_GOAL_PROFILE);
