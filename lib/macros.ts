import type { MacroNutrients } from "@/lib/types";

export function scaleNutrient(
  per100g: number | null | undefined,
  grams: number,
): number | null {
  if (per100g == null || Number.isNaN(per100g)) return null;
  return Math.round(((per100g * grams) / 100) * 10) / 10;
}

export function caloriesFromGrams(
  caloriesPer100g: number,
  grams: number,
): number {
  return Math.round((caloriesPer100g * grams) / 100);
}

export function emptyMacros(): MacroNutrients {
  return {
    proteinPer100g: null,
    fatPer100g: null,
    carbsPer100g: null,
  };
}

export function roundMacro(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}
