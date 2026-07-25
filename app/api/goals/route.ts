import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { calculateGoalKcal } from "@/lib/tdee";
import type { DailyGoalProfile } from "@/lib/types";
import { getUserGoal, saveUserGoal } from "@/lib/userData";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json({ goal: getUserGoal(user.id) });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<DailyGoalProfile>;
  const next: DailyGoalProfile = {
    gender: body.gender === "female" ? "female" : "male",
    age: Number(body.age),
    heightCm: Number(body.heightCm),
    weightKg: Number(body.weightKg),
    activity: body.activity || "light",
    goalKcal: 0,
  };

  if (
    !next.age ||
    !next.heightCm ||
    !next.weightKg ||
    Number.isNaN(next.age) ||
    Number.isNaN(next.heightCm) ||
    Number.isNaN(next.weightKg)
  ) {
    return NextResponse.json({ error: "目标参数无效" }, { status: 400 });
  }

  next.goalKcal = calculateGoalKcal(next);
  saveUserGoal(user.id, next);
  return NextResponse.json({ goal: next });
}
