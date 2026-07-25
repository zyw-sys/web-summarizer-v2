import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listWeightLogs,
  removeUserWeight,
  todayKey,
  upsertUserWeight,
} from "@/lib/userData";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json({ weights: listWeightLogs(user.id, 30) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json()) as {
    weightKg?: number;
    day?: string;
    note?: string;
  };

  const weightKg = Number(body.weightKg);
  if (!weightKg || weightKg < 20 || weightKg > 300) {
    return NextResponse.json(
      { error: "请输入有效体重（20-300 kg）" },
      { status: 400 },
    );
  }

  const day = body.day?.trim() || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "日期格式应为 YYYY-MM-DD" }, { status: 400 });
  }

  const weights = upsertUserWeight(
    user.id,
    Math.round(weightKg * 10) / 10,
    day,
    body.note?.trim() || null,
  );

  return NextResponse.json({ weights });
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

  return NextResponse.json({ weights: removeUserWeight(user.id, id) });
}
