import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getCurrentUser,
  getRequestMeta,
  getSessionId,
  revokeSession,
  writeLoginLog,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const meta = getRequestMeta(request);
    const user = await getCurrentUser();
    const sessionId = await getSessionId();

    if (sessionId) {
      revokeSession(sessionId);
    }
    await clearSessionCookie();

    if (user) {
      writeLoginLog({
        userId: user.id,
        username: user.username,
        sessionId,
        event: "logout",
        success: true,
        message: "退出登录",
        meta,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/auth/logout]", error);
    return NextResponse.json({ error: "退出失败，请稍后重试" }, { status: 500 });
  }
}
