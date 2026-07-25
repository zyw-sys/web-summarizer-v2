import { NextResponse } from "next/server";
import { getCurrentUser, listLoginLogs } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null, loginLogs: [] });
    }

    const loginLogs = listLoginLogs(user.id, 15);
    return NextResponse.json({ user, loginLogs });
  } catch (error) {
    console.error("[api/auth/me]", error);
    return NextResponse.json({ error: "获取用户信息失败" }, { status: 500 });
  }
}
