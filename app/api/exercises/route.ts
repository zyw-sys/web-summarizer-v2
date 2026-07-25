import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { estimateExerciseCalories } from "@/lib/exercises";
import {
  addUserExercise,
  getUserGoal,
  listTodayExercises,
  removeUserExercise,
} from "@/lib/userData";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const exercises = listTodayExercises(user.id);
  const burned = exercises.reduce((sum, item) => sum + item.calories, 0);
  return NextResponse.json({ exercises, burned });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    durationMin?: number;
    met?: number;
    calories?: number;
  };

  const name = body.name?.trim();
  const durationMin = Number(body.durationMin);
  if (!name || !durationMin || durationMin <= 0) {
    return NextResponse.json(
      { error: "请填写运动名称和有效时长（分钟）" },
      { status: 400 },
    );
  }

  const goal = getUserGoal(user.id);
  const met = Number(body.met) || 5;
  const calories =
    typeof body.calories === "number" && body.calories > 0
      ? Math.round(body.calories)
      : estimateExerciseCalories(met, goal.weightKg, durationMin);

  const exercises = addUserExercise(user.id, {
    name,
    durationMin,
    calories,
    met,
  });
  const burned = exercises.reduce((sum, item) => sum + item.calories, 0);

  return NextResponse.json({ exercises, burned });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少记录 id" }, { status: 400 });
  }

  const exercises = removeUserExercise(user.id, id);
  const burned = exercises.reduce((sum, item) => sum + item.calories, 0);
  return NextResponse.json({ exercises, burned });
}
