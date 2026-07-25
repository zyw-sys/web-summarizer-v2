import {
  calculateGoalKcal,
  DEFAULT_GOAL_PROFILE,
} from "@/lib/tdee";
import type { DailyGoalProfile } from "@/lib/types";

const STORAGE_KEY = "kazhi-daily-goal-v1";

export function loadDailyGoal(): DailyGoalProfile {
  if (typeof window === "undefined") return DEFAULT_GOAL_PROFILE;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GOAL_PROFILE;
    const parsed = JSON.parse(raw) as Partial<DailyGoalProfile>;
    const merged: DailyGoalProfile = {
      ...DEFAULT_GOAL_PROFILE,
      ...parsed,
    };
    if (!parsed.goalKcal) {
      merged.goalKcal = calculateGoalKcal(merged);
    }
    return merged;
  } catch {
    return DEFAULT_GOAL_PROFILE;
  }
}

export function saveDailyGoal(profile: DailyGoalProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
