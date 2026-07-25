import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "卡知 · 食物热量助手",
  description:
    "输入食品名称或上传食物图片，查询热量并获得 AI 饮食搭配建议",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
