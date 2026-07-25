"use client";

import {
  FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import AuthPanel, { type AuthUser } from "@/components/AuthPanel";
import BarcodePanel from "@/components/BarcodePanel";
import DailyGoalCard from "@/components/DailyGoalCard";
import ExercisePanel from "@/components/ExercisePanel";
import HistoryPanel from "@/components/HistoryPanel";
import MacroBars from "@/components/MacroBars";
import MealDiary from "@/components/MealDiary";
import {
  addMealItem,
  clearTodayMeals,
  loadTodayMeals,
  MEAL_SLOT_LABELS,
  removeMealItem,
  suggestMealSlot,
} from "@/lib/mealLog";
import { caloriesFromGrams, scaleNutrient } from "@/lib/macros";
import { COMMON_PORTIONS, QUICK_FOODS } from "@/lib/portions";
import { DEFAULT_GOAL_PROFILE } from "@/lib/tdee";
import type { DailyGoalProfile, MealLogItem, MealSlot } from "@/lib/types";

type Mode = "text" | "image" | "barcode";
type FeatureTab = "food" | "exercise" | "history";

type FoodResult = {
  query: string;
  searchQuery: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  advice: string;
  source?: "usda" | "ai_estimate";
};

type ImageFoodItem = {
  name: string;
  matchedName: string;
  searchQuery: string;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  estimatedGrams: number | null;
  estimatedTotalKcal: number | null;
  confidence: "high" | "medium" | "low";
  source: "usda" | "ai_estimate";
};

type ImageResult = {
  summary: string;
  foods: ImageFoodItem[];
  totalEstimatedKcal: number | null;
};

const CONFIDENCE_LABEL = {
  high: "较确定",
  medium: "一般",
  low: "不太确定",
} as const;

export default function FoodCalculator() {
  const [featureTab, setFeatureTab] = useState<FeatureTab>("food");
  const [mode, setMode] = useState<Mode>("text");
  const [foodName, setFoodName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("正在查询…");
  const [error, setError] = useState<string | null>(null);
  const [textResult, setTextResult] = useState<FoodResult | null>(null);
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [portionGrams, setPortionGrams] = useState(100);
  const [mealSlot, setMealSlot] = useState<MealSlot>("lunch");
  const [meals, setMeals] = useState<MealLogItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exerciseBurned, setExerciseBurned] = useState(0);
  const [goalProfile, setGoalProfile] =
    useState<DailyGoalProfile>(DEFAULT_GOAL_PROFILE);
  const [editableImageGrams, setEditableImageGrams] = useState<
    Record<number, number>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMealSlot(suggestMealSlot());
  }, []);

  useEffect(() => {
    async function loadMeals() {
      if (!user) {
        setMeals([]);
        setExerciseBurned(0);
        resetResults();
        setFoodName("");
        clearImage();
        return;
      }
      const [mealsRes, exercisesRes] = await Promise.all([
        fetch("/api/meals"),
        fetch("/api/exercises"),
      ]);
      if (mealsRes.ok) {
        const data = await mealsRes.json();
        setMeals(data.meals ?? []);
      }
      if (exercisesRes.ok) {
        const data = await exercisesRes.json();
        setExerciseBurned(data.burned ?? 0);
      }
    }
    loadMeals().catch(() => {
      setMeals([]);
      setExerciseBurned(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  function resetResults() {
    setError(null);
    setTextResult(null);
    setImageResult(null);
    setEditableImageGrams({});
  }

  function switchMode(next: Mode) {
    if (loading || next === mode) return;
    setMode(next);
    resetResults();
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleImageChange(file: File | null) {
    if (!file) {
      clearImage();
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("图片过大，请上传 4MB 以内的图片");
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageResult(null);
  }

  async function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = foodName.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setLoadingText("正在查询热量与营养素…");
    resetResults();

    try {
      const response = await fetch("/api/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodName: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "查询失败，请稍后重试");
      setTextResult(data as FoodResult);
      setPortionGrams(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleImageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageFile || loading) return;

    setLoading(true);
    setLoadingText("正在识别图片中的食物并估算热量…");
    resetResults();

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const response = await fetch("/api/food/image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "图片分析失败，请稍后重试");
      }
      const result = data as ImageResult;
      setImageResult(result);
      const gramsMap: Record<number, number> = {};
      result.foods.forEach((food, index) => {
        gramsMap[index] = food.estimatedGrams ?? 100;
      });
      setEditableImageGrams(gramsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片分析失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function addFoodToDiary(params: {
    name: string;
    grams: number;
    caloriesPer100g: number;
    proteinPer100g: number | null;
    fatPer100g: number | null;
    carbsPer100g: number | null;
  }) {
    const grams = Math.max(1, Math.round(params.grams));
    const payload = {
      name: params.name,
      grams,
      calories: caloriesFromGrams(params.caloriesPer100g, grams),
      protein: scaleNutrient(params.proteinPer100g, grams),
      fat: scaleNutrient(params.fatPer100g, grams),
      carbs: scaleNutrient(params.carbsPer100g, grams),
      slot: mealSlot,
    };

    if (user) {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setToast(data.error || "加入失败，请先登录");
        return;
      }
      setMeals(data.meals ?? []);
    } else {
      setMeals(addMealItem(payload));
    }
    setToast(`已加入${MEAL_SLOT_LABELS[mealSlot]}`);
  }

  async function handleRemoveMeal(id: string) {
    if (user) {
      const response = await fetch(`/api/meals?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) setMeals(data.meals ?? []);
      return;
    }
    setMeals(removeMealItem(id));
  }

  async function handleClearMeals() {
    if (user) {
      const response = await fetch("/api/meals?clear=today", {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) setMeals(data.meals ?? []);
      return;
    }
    setMeals(clearTodayMeals());
  }

  const portionCalories = textResult
    ? caloriesFromGrams(textResult.caloriesPer100g, portionGrams)
    : 0;

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-10 sm:px-8 sm:py-14">
      <header className="animate-rise mb-8 text-center">
        <p
          className="mb-3 text-sm font-semibold tracking-[0.22em] uppercase"
          style={{ color: "var(--accent)" }}
        >
          卡知
        </p>
        <h1
          className="text-4xl leading-tight tracking-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          食物热量助手
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">
          {user
            ? "查热量、看营养、记一日饮食"
            : "请先登录后使用热量计算功能"}
        </p>
      </header>

      <div className="mb-5 space-y-4">
        <AuthPanel
          onAuthChange={setUser}
          onReady={() => setAuthReady(true)}
        />
      </div>

      {authReady && !user && (
        <section
          className="animate-rise rounded-2xl px-6 py-10 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          <p
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            小张的卡知
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            热量查询、图片识别、饮食日记与每日目标仅对已登录用户开放，方便按账号区分数据。
          </p>
        </section>
      )}

      {authReady && user && (
      <>
      <div className="mb-5 space-y-4">
        <DailyGoalCard
          meals={meals}
          loggedIn
          exerciseBurned={exerciseBurned}
          onGoalChange={setGoalProfile}
        />
      </div>

      <div
        className="animate-rise mb-5 grid grid-cols-3 gap-2 rounded-2xl p-1"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        <ModeButton
          active={featureTab === "food"}
          onClick={() => setFeatureTab("food")}
        >
          查食物
        </ModeButton>
        <ModeButton
          active={featureTab === "exercise"}
          onClick={() => setFeatureTab("exercise")}
        >
          运动消耗
        </ModeButton>
        <ModeButton
          active={featureTab === "history"}
          onClick={() => setFeatureTab("history")}
        >
          体重趋势
        </ModeButton>
      </div>

      {featureTab === "exercise" && (
        <ExercisePanel
          weightKg={goalProfile.weightKg}
          onBurnedChange={setExerciseBurned}
        />
      )}

      {featureTab === "history" && <HistoryPanel />}

      {featureTab === "food" && (
      <>
      <div className="mb-5">
        <MealDiary
          meals={meals}
          loggedIn
          onRemove={handleRemoveMeal}
          onClear={handleClearMeals}
        />
      </div>

      <div
        className="animate-rise mb-5 grid grid-cols-3 gap-2 rounded-2xl p-1"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        <ModeButton
          active={mode === "text"}
          disabled={loading}
          onClick={() => switchMode("text")}
        >
          文字查询
        </ModeButton>
        <ModeButton
          active={mode === "image"}
          disabled={loading}
          onClick={() => switchMode("image")}
        >
          图片识别
        </ModeButton>
        <ModeButton
          active={mode === "barcode"}
          disabled={loading}
          onClick={() => switchMode("barcode")}
        >
          条形码
        </ModeButton>
      </div>

      {mode === "barcode" ? (
        <BarcodePanel onAddToDiary={addFoodToDiary} />
      ) : mode === "text" ? (
        <form onSubmit={handleTextSubmit} className="animate-rise space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_FOODS.map((food) => (
              <button
                key={food}
                type="button"
                disabled={loading}
                onClick={() => setFoodName(food)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50"
                style={{
                  border: "1px solid var(--line)",
                  background: foodName === food ? "rgba(47,107,79,0.1)" : "var(--surface)",
                }}
              >
                {food}
              </button>
            ))}
          </div>

          <div
            className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            <input
              id="food-name"
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="例如：鸡蛋、苹果、鸡胸肉"
              autoComplete="off"
              disabled={loading}
              className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-3 text-base outline-none placeholder:text-[var(--muted)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !foodName.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50"
              style={{ background: "var(--accent-deep)" }}
            >
              {loading ? (
                <>
                  <Spinner />
                  查询中
                </>
              ) : (
                "查询热量"
              )}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleImageSubmit} className="animate-rise">
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            <input
              ref={fileInputRef}
              id="food-image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={loading}
              className="sr-only"
              onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
            />

            {!imagePreview ? (
              <label
                htmlFor="food-image"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center transition hover:bg-black/[0.02]"
                style={{ borderColor: "var(--line)" }}
              >
                <span
                  className="text-lg tracking-tight"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  上传食物图片
                </span>
                <span className="mt-2 text-sm text-[var(--muted)]">
                  支持 JPG / PNG / WEBP，最大 4MB
                </span>
              </label>
            ) : (
              <div className="space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="待识别的食物图片"
                  className="max-h-72 w-full rounded-xl object-cover"
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold"
                    style={{ border: "1px solid var(--line)" }}
                  >
                    更换图片
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={clearImage}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--muted)]"
                    style={{ border: "1px solid var(--line)" }}
                  >
                    清除
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !imageFile}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--accent-deep)" }}
                  >
                    {loading ? (
                      <>
                        <Spinner />
                        识别中
                      </>
                    ) : (
                      "开始识别"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span>加入餐次：</span>
        {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setMealSlot(slot)}
            className="rounded-lg px-2.5 py-1 font-medium"
            style={{
              border: "1px solid var(--line)",
              background:
                mealSlot === slot ? "var(--accent-deep)" : "transparent",
              color: mealSlot === slot ? "#fff" : "var(--muted)",
            }}
          >
            {MEAL_SLOT_LABELS[slot]}
          </button>
        ))}
      </div>

      <section className="mt-8 flex-1 space-y-4" aria-live="polite">
        {loading && <LoadingPanel text={loadingText} />}

        {error && !loading && (
          <div
            className="animate-fade rounded-2xl px-5 py-4 text-sm leading-relaxed"
            style={{
              background: "rgba(196, 105, 58, 0.1)",
              border: "1px solid rgba(196, 105, 58, 0.28)",
              color: "var(--warm)",
            }}
          >
            {error}
          </div>
        )}

        {textResult && !loading && (
          <div
            className="animate-rise overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
              <p className="text-sm text-[var(--muted)]">匹配食品</p>
              <h2
                className="mt-1 text-2xl tracking-tight sm:text-3xl"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                {textResult.name}
              </h2>
              <p className="mt-2 text-xs text-[var(--muted)]">
                检索词：{textResult.searchQuery}
                {textResult.source === "ai_estimate"
                  ? " · 热量来源：AI 估算"
                  : " · 热量来源：USDA"}
              </p>
            </div>

            <div className="px-6 py-7 text-center sm:px-8">
              <p className="text-sm tracking-wide text-[var(--muted)]">
                每 100 克热量
              </p>
              <p
                className="mt-2 text-5xl font-semibold tracking-tight"
                style={{
                  fontFamily: "var(--font-display), serif",
                  color: "var(--accent)",
                }}
              >
                {textResult.caloriesPer100g}
                <span className="ml-2 text-xl font-medium text-[var(--muted)]">
                  kcal
                </span>
              </p>
            </div>

            <div className="border-t border-[var(--line)] px-6 py-6 sm:px-8">
              <MacroBars
                protein={textResult.proteinPer100g}
                fat={textResult.fatPer100g}
                carbs={textResult.carbsPer100g}
              />
            </div>

            <div className="border-t border-[var(--line)] px-6 py-6 sm:px-8">
              <p
                className="text-sm tracking-tight"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                份量计算
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {COMMON_PORTIONS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPortionGrams(preset.grams)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      border: "1px solid var(--line)",
                      background:
                        portionGrams === preset.grams
                          ? "rgba(47,107,79,0.12)"
                          : "transparent",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={portionGrams}
                  onChange={(e) =>
                    setPortionGrams(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-28 rounded-xl border border-[var(--line)] bg-white/50 px-3 py-2 text-sm outline-none"
                />
                <span className="text-sm text-[var(--muted)]">克</span>
                <span
                  className="ml-auto text-2xl font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  {portionCalories} kcal
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  addFoodToDiary({
                    name: textResult.name,
                    grams: portionGrams,
                    caloriesPer100g: textResult.caloriesPer100g,
                    proteinPer100g: textResult.proteinPer100g,
                    fatPer100g: textResult.fatPer100g,
                    carbsPer100g: textResult.carbsPer100g,
                  })
                }
                className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ background: "var(--accent-deep)" }}
              >
                加入今日饮食
              </button>
            </div>

            <div className="border-t border-[var(--line)] px-6 py-6 sm:px-8">
              <h3
                className="text-lg tracking-tight"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                饮食搭配建议
              </h3>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[var(--ink)]/90">
                {textResult.advice}
              </p>
            </div>
          </div>
        )}

        {imageResult && !loading && (
          <div
            className="animate-rise overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
              <p className="text-sm text-[var(--muted)]">图片识别结果</p>
              <h2
                className="mt-1 text-2xl tracking-tight"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                食物列表
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {imageResult.summary}
              </p>
              <p
                className="mt-4 text-3xl font-semibold"
                style={{ color: "var(--accent)" }}
              >
                {imageResult.foods.reduce((sum, food, index) => {
                  const grams = editableImageGrams[index] ?? food.estimatedGrams ?? 100;
                  return sum + caloriesFromGrams(food.caloriesPer100g, grams);
                }, 0)}
                <span className="ml-2 text-base font-medium text-[var(--muted)]">
                  kcal 合计（可改份量）
                </span>
              </p>
            </div>

            <ul className="divide-y divide-[var(--line)]">
              {imageResult.foods.map((food, index) => {
                const grams =
                  editableImageGrams[index] ?? food.estimatedGrams ?? 100;
                const total = caloriesFromGrams(food.caloriesPer100g, grams);
                return (
                  <li key={`${food.name}-${index}`} className="px-6 py-5 sm:px-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p
                          className="text-lg tracking-tight"
                          style={{ fontFamily: "var(--font-display), serif" }}
                        >
                          {food.name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {food.caloriesPer100g} kcal/100g · 置信度：
                          {CONFIDENCE_LABEL[food.confidence]}
                        </p>
                      </div>
                      <p
                        className="text-xl font-semibold"
                        style={{ color: "var(--accent)" }}
                      >
                        {total} kcal
                      </p>
                    </div>

                    <div className="mt-3">
                      <MacroBars
                        protein={scaleNutrient(food.proteinPer100g, grams)}
                        fat={scaleNutrient(food.fatPer100g, grams)}
                        carbs={scaleNutrient(food.carbsPer100g, grams)}
                        unitLabel="按当前份量"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                        份量
                        <input
                          type="number"
                          min={1}
                          max={2000}
                          value={grams}
                          onChange={(e) =>
                            setEditableImageGrams((prev) => ({
                              ...prev,
                              [index]: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="w-20 rounded-lg border border-[var(--line)] bg-white/50 px-2 py-1.5 text-sm outline-none"
                        />
                        g
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          addFoodToDiary({
                            name: food.name,
                            grams,
                            caloriesPer100g: food.caloriesPer100g,
                            proteinPer100g: food.proteinPer100g,
                            fatPer100g: food.fatPer100g,
                            carbsPer100g: food.carbsPer100g,
                          })
                        }
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ background: "var(--accent-deep)" }}
                      >
                        加入今日饮食
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {toast && (
        <div
          className="animate-fade fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ background: "var(--accent-deep)" }}
        >
          {toast}
        </div>
      )}
      </>
      )}
      </>
      )}

      <footer className="mt-12 space-y-2 text-center text-xs text-[var(--muted)]">
        <p>
          {user
            ? "宏量营养素 · 份量计算 · 每日目标 · 饮食日记（SQLite 按账号区分）"
            : "登录后可使用完整热量计算功能"}
        </p>
        <p>
          数据来源 USDA / AI 估算 · 图片识别通义千问 · 搭配建议 DeepSeek
        </p>
      </footer>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50"
      style={{
        background: active ? "var(--accent-deep)" : "transparent",
        color: active ? "#fff" : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="animate-spin-slow inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
      aria-hidden
    />
  );
}

function LoadingPanel({ text }: { text: string }) {
  return (
    <div
      className="animate-fade overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-6 py-5">
        <span
          className="animate-spin-slow inline-block h-5 w-5 rounded-full border-2 border-[var(--accent)]/25 border-t-[var(--accent)]"
          aria-hidden
        />
        <p className="text-sm text-[var(--muted)]">{text}</p>
      </div>
      <div className="space-y-4 px-6 py-7">
        <div className="animate-pulse-soft mx-auto h-3 w-28 rounded bg-[var(--line)]" />
        <div className="animate-pulse-soft mx-auto h-12 w-40 rounded bg-[var(--line)]" />
        <div className="animate-pulse-soft mt-6 h-3 w-full rounded bg-[var(--line)]" />
        <div className="animate-pulse-soft h-3 w-5/6 rounded bg-[var(--line)]" />
      </div>
    </div>
  );
}
