import { roundMacro } from "@/lib/macros";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
  };
};

async function chatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages,
      temperature: options?.temperature ?? 0.6,
      max_tokens: options?.maxTokens ?? 600,
      thinking: { type: "disabled" },
    }),
  });

  const data = (await response.json()) as DeepSeekResponse;

  if (!response.ok) {
    throw new Error(
      data.error?.message || `DeepSeek 请求失败（${response.status}）`,
    );
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    const finish = data.choices?.[0]?.finish_reason;
    throw new Error(
      finish === "length"
        ? "DeepSeek 返回被截断（token 不足），请稍后重试"
        : "DeepSeek 返回内容为空",
    );
  }

  return content;
}

export async function normalizeFoodQuery(
  foodName: string,
  apiKey: string,
): Promise<string> {
  const content = await chatCompletion(
    apiKey,
    [
      {
        role: "system",
        content:
          "You convert food names into concise English search terms for the USDA FoodData Central database. Reply with ONLY the English food name, no quotes, no explanation. Prefer common whole-food names (e.g. egg, apple, chicken breast, cooked white rice).",
      },
      {
        role: "user",
        content: foodName,
      },
    ],
    { temperature: 0.2, maxTokens: 64 },
  );

  return content.replace(/^["'\s]+|["'\s]+$/g, "");
}

export async function estimateCaloriesPer100g(
  foodName: string,
  searchQuery: string,
  apiKey: string,
): Promise<{
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
}> {
  const content = await chatCompletion(
    apiKey,
    [
      {
        role: "system",
        content:
          '你是营养数据助手。根据常见食品营养知识估算每100克数据。只返回 JSON：{"name":"中文常用名","caloriesPer100g":数字,"proteinPer100g":数字,"fatPer100g":数字,"carbsPer100g":数字}',
      },
      {
        role: "user",
        content: `食品：${foodName}\n英文检索名：${searchQuery}`,
      },
    ],
    { temperature: 0.2, maxTokens: 160 },
  );

  const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) {
    throw new Error("AI 热量估算失败，请稍后重试");
  }

  const parsed = JSON.parse(jsonText) as {
    name?: string;
    caloriesPer100g?: number;
    proteinPer100g?: number;
    fatPer100g?: number;
    carbsPer100g?: number;
  };

  if (
    !parsed.name ||
    typeof parsed.caloriesPer100g !== "number" ||
    Number.isNaN(parsed.caloriesPer100g)
  ) {
    throw new Error("AI 热量估算结果无效，请稍后重试");
  }

  return {
    name: parsed.name,
    caloriesPer100g: Math.round(parsed.caloriesPer100g * 10) / 10,
    proteinPer100g: roundMacro(parsed.proteinPer100g),
    fatPer100g: roundMacro(parsed.fatPer100g),
    carbsPer100g: roundMacro(parsed.carbsPer100g),
  };
}

export async function generateDietAdvice(
  params: {
    originalName: string;
    matchedName: string;
    caloriesPer100g: number;
    proteinPer100g?: number | null;
    fatPer100g?: number | null;
    carbsPer100g?: number | null;
  },
  apiKey: string,
): Promise<string> {
  const {
    originalName,
    matchedName,
    caloriesPer100g,
    proteinPer100g,
    fatPer100g,
    carbsPer100g,
  } = params;

  return chatCompletion(
    apiKey,
    [
      {
        role: "system",
        content:
          "你是一位务实的营养搭配顾问。用简洁中文回答，不要标题符号堆砌，不要恐吓式措辞。分 3 小段：1）热量与宏量营养解读；2）推荐搭配；3）食用建议。总字数控制在 200 字以内。",
      },
      {
        role: "user",
        content: `用户查询：${originalName}\n匹配食品：${matchedName}\n每100克：${caloriesPer100g} kcal，蛋白质 ${proteinPer100g ?? "未知"} g，脂肪 ${fatPer100g ?? "未知"} g，碳水 ${carbsPer100g ?? "未知"} g\n请给出饮食搭配建议。`,
      },
    ],
    { temperature: 0.7, maxTokens: 500 },
  );
}
