import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateDietAdvice,
  normalizeFoodQuery,
} from "@/lib/deepseek";
import { resolveFoodNutrition } from "@/lib/nutrition";

export const runtime = "nodejs";

type FoodRequestBody = {
  foodName?: string;
};

function toFriendlyError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "服务暂时不可用，请稍后重试";
  }

  const message = error.message;
  if (message.toLowerCase().includes("fetch failed")) {
    return "网络请求失败，无法连接外部服务。请检查网络后重试。";
  }

  return message;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再使用热量计算" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as FoodRequestBody;
    const foodName = body.foodName?.trim();

    if (!foodName) {
      return NextResponse.json(
        { error: "请输入食品名称" },
        { status: 400 },
      );
    }

    if (foodName.length > 80) {
      return NextResponse.json(
        { error: "食品名称过长，请缩短后再试" },
        { status: 400 },
      );
    }

    const usdaKey = process.env.USDA_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    if (!deepseekKey) {
      return NextResponse.json(
        { error: "未配置 DEEPSEEK_API_KEY，请在 .env.local 中设置" },
        { status: 500 },
      );
    }

    const searchQuery = await normalizeFoodQuery(foodName, deepseekKey);
    const nutrition = await resolveFoodNutrition({
      foodName,
      searchQuery,
      usdaKey,
      deepseekKey,
    });

    const advice = await generateDietAdvice(
      {
        originalName: foodName,
        matchedName: nutrition.name,
        caloriesPer100g: nutrition.caloriesPer100g,
        proteinPer100g: nutrition.proteinPer100g,
        fatPer100g: nutrition.fatPer100g,
        carbsPer100g: nutrition.carbsPer100g,
      },
      deepseekKey,
    );

    return NextResponse.json({
      query: foodName,
      searchQuery,
      name: nutrition.name,
      caloriesPer100g: nutrition.caloriesPer100g,
      proteinPer100g: nutrition.proteinPer100g,
      fatPer100g: nutrition.fatPer100g,
      carbsPer100g: nutrition.carbsPer100g,
      advice,
      fdcId: nutrition.fdcId,
      source: nutrition.source ?? "usda",
    });
  } catch (error) {
    const message = toFriendlyError(error);
    console.error("[api/food]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
