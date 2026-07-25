import { estimateCaloriesPer100g } from "@/lib/deepseek";
import { searchFoodCalories, type FoodNutrition } from "@/lib/usda";

export async function resolveFoodNutrition(params: {
  foodName: string;
  searchQuery: string;
  usdaKey?: string;
  deepseekKey: string;
}): Promise<FoodNutrition> {
  const { foodName, searchQuery, usdaKey, deepseekKey } = params;

  if (usdaKey) {
    try {
      const nutrition = await searchFoodCalories(searchQuery, usdaKey);
      if (nutrition) return nutrition;
    } catch (error) {
      const message = (
        error instanceof Error ? error.message : ""
      ).toLowerCase();
      const canFallback =
        message.includes("无法连接 usda") ||
        message.includes("fetch failed") ||
        message.includes("网络") ||
        message.includes("timeout") ||
        message.includes("aborted");

      if (!canFallback) {
        throw error;
      }

      console.warn("[nutrition] USDA unavailable, fallback to AI:", message);
    }
  }

  const estimated = await estimateCaloriesPer100g(
    foodName,
    searchQuery,
    deepseekKey,
  );

  return {
    fdcId: 0,
    name: estimated.name,
    caloriesPer100g: estimated.caloriesPer100g,
    proteinPer100g: estimated.proteinPer100g,
    fatPer100g: estimated.fatPer100g,
    carbsPer100g: estimated.carbsPer100g,
    source: "ai_estimate",
  };
}
