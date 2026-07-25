import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDayHistory, listWeightLogs } from "@/lib/userData";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const daysParam = Number(new URL(request.url).searchParams.get("days") || 14);
  const days = [7, 14, 30].includes(daysParam) ? daysParam : 14;

  return NextResponse.json({
    history: getDayHistory(user.id, days),
    weights: listWeightLogs(user.id, days),
    days,
  });
}
