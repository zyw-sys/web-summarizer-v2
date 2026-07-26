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
    <div className="page-shell mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      {!authReady && (
        <div className="animate-fade flex min-h-[60vh] flex-col items-center justify-center gap-4 text-sm text-[var(--muted)]">
          <span
            className="animate-spin-slow inline-block h-5 w-5 rounded-full border-2 border-[var(--accent)]/25 border-t-[var(--accent)]"
            aria-hidden
          />
          正在准备卡知…
          <div className="sr-only">
            <AuthPanel
              onAuthChange={setUser}
              onReady={() => setAuthReady(true)}
            />
          </div>
        </div>
      )}

      {authReady && !user && (
        <section className="hero-stage animate-rise flex flex-col justify-end px-6 py-8 sm:px-10 sm:py-12">
          <div className="mb-auto pt-4">
            <h1 className="display text-6xl leading-none text-white sm:text-7xl">
              卡知
            </h1>
            <p className="animate-rise-delay mt-5 max-w-md text-lg leading-relaxed text-white/88 sm:text-xl">
              查清每一口，吃得更明白
            </p>
            <p className="animate-rise-delay-2 mt-3 max-w-sm text-sm leading-relaxed text-white/65">
              文字查询 · 拍照识别 · 条码扫描 · 一日热量预算
            </p>
          </div>
          <div className="mt-10 w-full max-w-md">
            <AuthPanel
              variant="hero"
              onAuthChange={setUser}
              onReady={() => setAuthReady(true)}
            />
          </div>
        </section>
      )}

      {authReady && user && (
      <>
      <header className="animate-rise mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl leading-none tracking-tight sm:text-5xl">
            卡知
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            查热量、看营养、记一日饮食
          </p>
        </div>
        <AuthPanel
          variant="compact"
          onAuthChange={setUser}
          onReady={() => setAuthReady(true)}
        />
      </header>

      <div className="mb-6">
        <DailyGoalCard
          meals={meals}
          loggedIn
          exerciseBurned={exerciseBurned}
          onGoalChange={setGoalProfile}
        />
      </div>

      <div className="animate-rise tab-rail mb-6 grid-cols-3">
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
      <div className="mb-6">
        <MealDiary
          meals={meals}
          loggedIn
          onRemove={handleRemoveMeal}
          onClear={handleClearMeals}
        />
      </div>

      <div className="animate-rise tab-rail mb-5 grid-cols-3">
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
        <form onSubmit={handleTextSubmit} className="animate-rise space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_FOODS.map((food) => (
              <button
                key={food}
                type="button"
                disabled={loading}
                onClick={() => setFoodName(food)}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
                style={{
                  border: "1px solid var(--line)",
                  background:
                    foodName === food ? "var(--accent-soft)" : "transparent",
                  color: foodName === food ? "var(--accent-deep)" : "var(--muted)",
                }}
              >
                {food}
              </button>
            ))}
          </div>

          <div className="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <input
              id="food-name"
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="例如：鸡蛋、苹果、鸡胸肉"
              autoComplete="off"
              disabled={loading}
              className="min-w-0 flex-1 rounded-full border-0 bg-transparent px-4 py-3 text-base outline-none placeholder:text-[var(--muted)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !foodName.trim()}
              className="btn-primary px-6 py-3 text-sm"
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
          <div className="panel p-4">
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
                className="flex cursor-pointer flex-col items-center justify-center rounded-[1rem] border border-dashed px-4 py-12 text-center transition hover:bg-black/[0.02]"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="display text-xl tracking-tight">
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
                  className="max-h-72 w-full rounded-[1rem] object-cover"
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-ghost flex-1 px-4 py-3 text-sm"
                  >
                    更换图片
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={clearImage}
                    className="btn-ghost flex-1 px-4 py-3 text-sm text-[var(--muted)]"
                  >
                    清除
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !imageFile}
                    className="btn-primary flex-1 px-4 py-3 text-sm"
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

      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span>加入餐次</span>
        {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setMealSlot(slot)}
            className="rounded-full px-3 py-1 font-medium transition"
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
            className="animate-fade rounded-[1.25rem] px-5 py-4 text-sm leading-relaxed"
            style={{
              background: "rgba(154, 75, 26, 0.08)",
              border: "1px solid rgba(154, 75, 26, 0.22)",
              color: "var(--warn)",
            }}
          >
            {error}
          </div>
        )}

        {textResult && !loading && (
          <div className="panel animate-rise overflow-hidden">
            <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
              <p className="text-sm text-[var(--muted)]">匹配食品</p>
              <h2 className="display mt-1 text-2xl tracking-tight sm:text-3xl">
                {textResult.name}
              </h2>
              <p className="mt-2 text-xs text-[var(--muted)]">
                检索词：{textResult.searchQuery}
                {textResult.source === "ai_estimate"
                  ? " · 热量来源：AI 估算"
                  : " · 热量来源：USDA"}
              </p>
            </div>

            <div className="px-6 py-8 text-center sm:px-8">
              <p className="text-sm tracking-wide text-[var(--muted)]">
                每 100 克热量
              </p>
              <p
                className="display mt-2 text-5xl font-semibold tracking-tight sm:text-6xl"
                style={{ color: "var(--accent)" }}
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
              <p className="display text-sm tracking-tight">份量计算</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {COMMON_PORTIONS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPortionGrams(preset.grams)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{
                      border: "1px solid var(--line)",
                      background:
                        portionGrams === preset.grams
                          ? "var(--accent-soft)"
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
                  className="field w-28"
                />
                <span className="text-sm text-[var(--muted)]">克</span>
                <span
                  className="display ml-auto text-2xl font-semibold"
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
                className="btn-primary mt-4 w-full px-4 py-3 text-sm"
              >
                加入今日饮食
              </button>
            </div>

            <div className="border-t border-[var(--line)] px-6 py-6 sm:px-8">
              <h3 className="display text-lg tracking-tight">饮食搭配建议</h3>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[var(--ink)]/90">
                {textResult.advice}
              </p>
            </div>
          </div>
        )}

        {imageResult && !loading && (
          <div className="panel animate-rise overflow-hidden">
            <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
              <p className="text-sm text-[var(--muted)]">图片识别结果</p>
              <h2 className="display mt-1 text-2xl tracking-tight">食物列表</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {imageResult.summary}
              </p>
              <p
                className="display mt-4 text-3xl font-semibold"
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
                        <p className="display text-lg tracking-tight">
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
                          className="field w-20 py-1.5"
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
                        className="btn-primary px-3 py-1.5 text-xs"
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
        <div className="btn-primary animate-fade fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
      </>
      )}
      </>
      )}

      <footer className="mt-14 space-y-2 text-center text-xs text-[var(--muted)]">
        <p>
          {user
            ? "宏量营养素 · 份量计算 · 每日目标 · 饮食日记"
            : "登录后可使用完整热量计算功能"}
        </p>
        <p>数据来源 USDA / AI · 识图通义千问 · 建议 DeepSeek</p>
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
      data-active={active}
      className="tab-btn disabled:opacity-50"
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
    <div className="panel animate-fade overflow-hidden">
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
