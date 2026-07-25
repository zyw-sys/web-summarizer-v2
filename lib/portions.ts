export type PortionPreset = {
  label: string;
  grams: number;
};

export const COMMON_PORTIONS: PortionPreset[] = [
  { label: "50g", grams: 50 },
  { label: "100g", grams: 100 },
  { label: "150g", grams: 150 },
  { label: "200g", grams: 200 },
  { label: "1 份约 80g", grams: 80 },
];

export const QUICK_FOODS = [
  "鸡蛋",
  "米饭",
  "鸡胸肉",
  "苹果",
  "香蕉",
  "牛奶",
  "燕麦",
  "西兰花",
] as const;
