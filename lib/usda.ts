import { roundMacro } from "@/lib/macros";
import type { FoodNutrition } from "@/lib/types";

export type { FoodNutrition };

type UsdaNutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: UsdaNutrient[];
};

type UsdaSearchResponse = {
  foods?: UsdaFood[];
  totalHits?: number;
};

const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const MAX_RETRIES = 2;

function nutrientValue(
  nutrients: UsdaNutrient[],
  ids: number[],
  numbers: string[],
): number | null {
  const found = nutrients.find((n) => {
    const number = String(n.nutrientNumber ?? "");
    const byId = n.nutrientId != null && ids.includes(n.nutrientId);
    const byNumber = numbers.includes(number);
    return byId || byNumber;
  });

  if (found?.value == null || Number.isNaN(found.value)) return null;
  return roundMacro(found.value);
}

function extractNutrition(nutrients: UsdaNutrient[] = []) {
  // USDA: 1008 Energy(kcal), 1003 Protein, 1004 Total lipid, 1005 Carbohydrate
  return {
    caloriesPer100g: nutrientValue(nutrients, [1008], ["1008"]),
    proteinPer100g: nutrientValue(nutrients, [1003], ["1003"]),
    fatPer100g: nutrientValue(nutrients, [1004], ["1004"]),
    carbsPer100g: nutrientValue(nutrients, [1005], ["1005"]),
  };
}

function scoreFood(food: UsdaFood, query: string): number {
  const desc = food.description.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;

  if (desc === q) score += 100;
  else if (desc.startsWith(q)) score += 60;
  else if (desc.includes(q)) score += 30;

  if (food.dataType === "Foundation") score += 25;
  else if (food.dataType === "SR Legacy") score += 20;
  else if (food.dataType === "Survey (FNDDS)") score += 10;

  const { caloriesPer100g } = extractNutrition(food.foodNutrients);
  if (caloriesPer100g != null) score += 15;

  return score;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  const cause = (error as Error & { cause?: { code?: string; message?: string } })
    .cause;
  const causeCode = (cause?.code ?? "").toUpperCase();
  return (
    message.includes("fetch failed") ||
    message.includes("aborted due to timeout") ||
    message.includes("timeout") ||
    name.includes("timeout") ||
    name.includes("abort") ||
    causeCode.includes("TIMEOUT") ||
    causeCode.includes("ECONN") ||
    causeCode.includes("ENOTFOUND") ||
    causeCode.includes("UND_ERR")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUsdaOnce(
  query: string,
  apiKey: string,
): Promise<Response> {
  const url = new URL(USDA_SEARCH_URL);
  url.searchParams.set("api_key", apiKey);

  return fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      pageSize: 10,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
}

export async function searchFoodCalories(
  query: string,
  apiKey: string,
): Promise<FoodNutrition | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchUsdaOnce(query, apiKey);

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 403 || response.status === 401) {
          throw new Error(
            "USDA API Key 无效，请到 https://fdc.nal.usda.gov/api-key-signup.html 重新申请，并更新 .env.local",
          );
        }
        throw new Error(
          `USDA 查询失败（${response.status}）：${text.slice(0, 200)}`,
        );
      }

      const data = (await response.json()) as UsdaSearchResponse;
      const foods = data.foods ?? [];
      if (foods.length === 0) return null;

      const ranked = [...foods].sort(
        (a, b) => scoreFood(b, query) - scoreFood(a, query),
      );

      for (const food of ranked) {
        const nutrition = extractNutrition(food.foodNutrients);
        if (nutrition.caloriesPer100g == null) continue;

        return {
          fdcId: food.fdcId,
          name: food.description,
          caloriesPer100g: nutrition.caloriesPer100g,
          proteinPer100g: nutrition.proteinPer100g,
          fatPer100g: nutrition.fatPer100g,
          carbsPer100g: nutrition.carbsPer100g,
          dataType: food.dataType,
          source: "usda",
        };
      }

      return null;
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === MAX_RETRIES) {
        break;
      }
      await sleep(800 * attempt);
    }
  }

  if (isNetworkError(lastError)) {
    throw new Error(
      "无法连接 USDA 营养数据库（网络超时）。将尝试使用 AI 估算热量。",
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("USDA 查询失败");
}
