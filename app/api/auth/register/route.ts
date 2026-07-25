import { NextResponse } from "next/server";
import {
  createSession,
  createUser,
  findUserByUsername,
  getAdminUsername,
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

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(username)) {
      return NextResponse.json(
        { error: "用户名需为 2-20 位中英文、数字或下划线" },
        { status: 400 },
      );
    }

    if (password.length < 6 || password.length > 64) {
      return NextResponse.json(
        { error: "密码长度需在 6-64 位之间" },
        { status: 400 },
      );
    }

    if (username.toLowerCase() === getAdminUsername().toLowerCase()) {
      return NextResponse.json(
        { error: "该用户名为系统保留，请更换" },
        { status: 400 },
      );
    }

    if (findUserByUsername(username)) {
      writeLoginLog({
        username,
        event: "login_failed",
        success: false,
        message: "注册失败：用户名已存在",
        meta,
      });
      return NextResponse.json({ error: "用户名已被占用" }, { status: 409 });
    }

    const user = createUser(username, password, "user");
    const { sessionId, expiresAt } = createSession(user.id, meta);
    await setSessionCookie(sessionId, expiresAt);

    writeLoginLog({
      userId: user.id,
      username: user.username,
      sessionId,
      event: "register",
      success: true,
      message: "注册并登录成功",
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
    console.error("[api/auth/register]", error);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
