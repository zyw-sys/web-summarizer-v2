import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupBarcodeProduct } from "@/lib/openFoodFacts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再扫描条形码" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { barcode?: string };
    const barcode = body.barcode?.trim() ?? "";
    if (!barcode) {
      return NextResponse.json({ error: "请提供条形码" }, { status: 400 });
    }

    const product = await lookupBarcodeProduct(barcode);
    if (!product) {
      return NextResponse.json(
        { error: "未找到该条形码对应的包装食品，可尝试手动文字查询" },
        { status: 404 },
      );
    }

    if (product.caloriesPer100g == null) {
      return NextResponse.json(
        {
          error: `已找到「${product.name}」，但缺少热量数据，请改用文字查询`,
          product,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      product,
      name: product.name,
      caloriesPer100g: product.caloriesPer100g,
      proteinPer100g: product.proteinPer100g,
      fatPer100g: product.fatPer100g,
      carbsPer100g: product.carbsPer100g,
      source: "open_food_facts",
      advice: product.brand
        ? `包装食品来自 ${product.brand}${product.quantity ? `，规格 ${product.quantity}` : ""}。热量数据来自 Open Food Facts，供参考。`
        : "热量数据来自 Open Food Facts 开源食品库，供参考。",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "条形码查询失败，请稍后重试";
    console.error("[api/food/barcode]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
