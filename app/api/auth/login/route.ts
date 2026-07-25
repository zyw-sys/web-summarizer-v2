import { NextResponse } from "next/server";
import {
  authenticateUser,
  createSession,
  getRequestMeta,
  setSessionCookie,
  writeLoginLog,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    const meta = getRequestMeta(request);

    if (!username || !password) {
      return NextResponse.json(
        { error: "请输入用户名和密码" },
        { status: 400 },
      );
    }

    const user = authenticateUser(username, password);
    if (!user) {
      writeLoginLog({
        username,
        event: "login_failed",
        success: false,
        message: "登录失败：用户名或密码错误",
        meta,
      });
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 },
      );
    }

    const { sessionId, expiresAt } = createSession(user.id, meta);
    await setSessionCookie(sessionId, expiresAt);

    writeLoginLog({
      userId: user.id,
      username: user.username,
      sessionId,
      event: "login",
      success: true,
      message: "登录成功",
      meta,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[api/auth/login]", error);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
