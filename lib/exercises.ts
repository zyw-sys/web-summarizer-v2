/** 常见运动 MET 值（估算） */
export type ExercisePreset = {
  name: string;
  met: number;
};

export const EXERCISE_PRESETS: ExercisePreset[] = [
  { name: "快走", met: 3.5 },
  { name: "慢跑", met: 7.0 },
  { name: "跑步", met: 9.8 },
  { name: "骑自行车", met: 6.8 },
  { name: "游泳", met: 8.0 },
  { name: "跳绳", met: 11.0 },
  { name: "力量训练", met: 5.0 },
  { name: "瑜伽", met: 2.5 },
  { name: "爬山", met: 6.5 },
  { name: "打球", met: 7.5 },
];

/** 消耗热量 ≈ MET × 体重(kg) × 小时 */
export function estimateExerciseCalories(
  met: number,
  weightKg: number,
  durationMin: number,
): number {
  const hours = Math.max(durationMin, 1) / 60;
  const weight = Math.max(weightKg, 30);
  return Math.round(met * weight * hours);
}
