import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  addUserMeal,
  clearUserTodayMeals,
  listTodayMeals,
  removeUserMeal,
} from "@/lib/userData";
import type { MealSlot } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json({ meals: listTodayMeals(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    grams?: number;
    calories?: number;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
    slot?: MealSlot;
  };

  if (!body.name?.trim() || !body.grams || body.calories == null || !body.slot) {
    return NextResponse.json({ error: "饮食记录参数不完整" }, { status: 400 });
  }

  const meals = addUserMeal(user.id, {
    name: body.name.trim(),
    grams: body.grams,
    calories: body.calories,
    protein: body.protein ?? null,
    fat: body.fat ?? null,
    carbs: body.carbs ?? null,
    slot: body.slot,
  });

  return NextResponse.json({ meals });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const clear = searchParams.get("clear");

  if (clear === "today") {
    return NextResponse.json({ meals: clearUserTodayMeals(user.id) });
  }

  if (!id) {
    return NextResponse.json({ error: "缺少记录 id" }, { status: 400 });
  }

  return NextResponse.json({ meals: removeUserMeal(user.id, id) });
}
