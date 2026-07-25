import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { analyzeFoodImage } from "@/lib/qwen";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function toFriendlyError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "服务暂时不可用，请稍后重试";
  }

  const message = error.message.toLowerCase();
  if (
    message.includes("fetch failed") ||
    message.includes("aborted due to timeout") ||
    message.includes("timeout")
  ) {
    return "识别超时，请换一张更小更清晰的图片后重试";
  }

  return error.message;
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再使用图片识别" },
        { status: 401 },
      );
    }

    const dashscopeKey = process.env.DASHSCOPE_API_KEY;

    if (!dashscopeKey) {
      return NextResponse.json(
        {
          error:
            "未配置 DASHSCOPE_API_KEY，请在 .env.local 中设置通义千问密钥",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "请上传一张食物图片" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "仅支持 JPG、PNG、WEBP、GIF 图片" },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "图片过大，请上传 4MB 以内的图片" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageDataUrl = bufferToDataUrl(buffer, file.type);
    const analysis = await analyzeFoodImage(imageDataUrl, dashscopeKey);

    if (analysis.foods.length === 0) {
      return NextResponse.json(
        {
          error:
            "未在图片中识别到食物，请换一张更清晰、食物更明显的照片",
        },
        { status: 404 },
      );
    }

    const foods = analysis.foods.map((detected) => ({
      name: detected.name,
      matchedName: detected.name,
      searchQuery: detected.searchName,
      caloriesPer100g: detected.caloriesPer100g,
      proteinPer100g: detected.proteinPer100g,
      fatPer100g: detected.fatPer100g,
      carbsPer100g: detected.carbsPer100g,
      estimatedGrams: detected.estimatedGrams,
      estimatedTotalKcal: detected.estimatedTotalKcal,
      confidence: detected.confidence,
      source: "ai_estimate" as const,
    }));

    const totalEstimatedKcal = foods.reduce((sum, item) => {
      return sum + (item.estimatedTotalKcal ?? 0);
    }, 0);

    const hasAllPortions = foods.every(
      (item) => item.estimatedTotalKcal != null,
    );

    return NextResponse.json({
      summary: analysis.summary,
      foods,
      totalEstimatedKcal: hasAllPortions ? totalEstimatedKcal : null,
    });
  } catch (error) {
    const message = toFriendlyError(error);
    console.error("[api/food/image]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
