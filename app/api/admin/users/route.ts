import { NextResponse } from "next/server";
import { listUsersForAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 });
  }

  return NextResponse.json({ users: listUsersForAdmin() });
}
