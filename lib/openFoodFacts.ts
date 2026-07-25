export type BarcodeProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  imageUrl: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  servingSize: string | null;
};

type OffProduct = {
  product_name?: string;
  product_name_zh?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  image_front_small_url?: string;
  image_url?: string;
  nutriments?: Record<string, number | undefined>;
};

function pickNumber(...values: Array<number | undefined | null>): number | null {
  for (const value of values) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return Math.round(value * 10) / 10;
    }
  }
  return null;
}

export async function lookupBarcodeProduct(
  barcode: string,
): Promise<BarcodeProduct | null> {
  const code = barcode.trim();
  if (!/^\d{8,14}$/.test(code)) {
    throw new Error("条形码格式不正确，请输入 8-14 位数字");
  }

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json`,
    {
      headers: {
        "User-Agent": "KazhiCalorieApp/1.0 (education project)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`包装食品查询失败（${response.status}）`);
  }

  const data = (await response.json()) as {
    status?: number;
    product?: OffProduct;
  };

  if (data.status !== 1 || !data.product) {
    return null;
  }

  const product = data.product;
  const nutriments = product.nutriments ?? {};
  const name =
    product.product_name_zh ||
    product.product_name ||
    product.product_name_en ||
    "未知包装食品";

  const caloriesPer100g = pickNumber(
    nutriments["energy-kcal_100g"],
    nutriments.energy_kcal_100g,
    typeof nutriments.energy_100g === "number"
      ? nutriments.energy_100g / 4.184
      : null,
  );

  return {
    barcode: code,
    name,
    brand: product.brands || null,
    quantity: product.quantity || null,
    imageUrl:
      product.image_front_small_url || product.image_url || null,
    caloriesPer100g,
    proteinPer100g: pickNumber(nutriments.proteins_100g),
    fatPer100g: pickNumber(nutriments.fat_100g),
    carbsPer100g: pickNumber(nutriments.carbohydrates_100g),
    servingSize: product.serving_size || null,
  };
}
