import { roundMacro } from "@/lib/macros";

const QWEN_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export type DetectedFood = {
  name: string;
  searchName: string;
  estimatedGrams: number | null;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  estimatedTotalKcal: number | null;
  confidence: "high" | "medium" | "low";
};

export type ImageFoodAnalysis = {
  summary: string;
  foods: DetectedFood[];
};

type QwenResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
  };
};

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? text).match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) {
    throw new Error("通义千问未返回有效的 JSON 结果");
  }
  return JSON.parse(candidate);
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

export async function analyzeFoodImage(
  imageDataUrl: string,
  apiKey: string,
): Promise<ImageFoodAnalysis> {
  const model = process.env.QWEN_VL_MODEL || "qwen-vl-plus";

  const response = await fetch(QWEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            '你是食物识别与营养估算助手。识别图片中的食物，忽略餐具与背景。只返回 JSON：{"summary":"一句话总结","foods":[{"name":"中文名","searchName":"英文检索名","estimatedGrams":克数或null,"caloriesPer100g":数字,"proteinPer100g":数字,"fatPer100g":数字,"carbsPer100g":数字,"estimatedTotalKcal":该份总热量或null,"confidence":"high|medium|low"}]}。最多 8 种食物。',
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
            {
              type: "text",
              text: "请识别图中食物并估算热量与宏量营养素，按要求返回 JSON。",
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(55000),
  });

  const data = (await response.json()) as QwenResponse;

  if (!response.ok) {
    throw new Error(
      data.error?.message || `通义千问识图失败（${response.status}）`,
    );
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("通义千问返回内容为空");
  }

  const parsed = parseJsonObject(content) as {
    summary?: string;
    foods?: Array<{
      name?: string;
      searchName?: string;
      estimatedGrams?: number | null;
      caloriesPer100g?: number | null;
      proteinPer100g?: number | null;
      fatPer100g?: number | null;
      carbsPer100g?: number | null;
      estimatedTotalKcal?: number | null;
      confidence?: string;
    }>;
  };

  const foods = (parsed.foods ?? [])
    .filter((item) => item.name?.trim())
    .slice(0, 8)
    .map((item) => {
      const confidence = item.confidence;
      const normalizedConfidence =
        confidence === "high" ||
        confidence === "medium" ||
        confidence === "low"
          ? confidence
          : "medium";

      const gramsRaw = toPositiveNumber(item.estimatedGrams);
      const grams = gramsRaw != null ? Math.round(gramsRaw) : null;
      const caloriesPer100g = toPositiveNumber(item.caloriesPer100g) ?? 0;

      let estimatedTotalKcal = toPositiveNumber(item.estimatedTotalKcal);
      if (estimatedTotalKcal == null && grams != null && caloriesPer100g > 0) {
        estimatedTotalKcal = Math.round((caloriesPer100g * grams) / 100);
      } else if (estimatedTotalKcal != null) {
        estimatedTotalKcal = Math.round(estimatedTotalKcal);
      }

      return {
        name: item.name!.trim(),
        searchName: (item.searchName || item.name || "").trim(),
        estimatedGrams: grams,
        caloriesPer100g,
        proteinPer100g: roundMacro(item.proteinPer100g),
        fatPer100g: roundMacro(item.fatPer100g),
        carbsPer100g: roundMacro(item.carbsPer100g),
        estimatedTotalKcal,
        confidence: normalizedConfidence as DetectedFood["confidence"],
      };
    })
    .filter((item) => item.caloriesPer100g > 0);

  return {
    summary: parsed.summary?.trim() || "已识别图片中的食物",
    foods,
  };
}
