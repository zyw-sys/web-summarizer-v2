import { NextResponse } from "next/server";
import { getUserDetailForAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要超级管理员权限" }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!userId) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }

  const detail = getUserDetailForAdmin(userId);
  if (!detail) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
