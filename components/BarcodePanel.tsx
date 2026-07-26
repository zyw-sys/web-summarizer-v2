"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import MacroBars from "@/components/MacroBars";
import { COMMON_PORTIONS } from "@/lib/portions";
import { caloriesFromGrams } from "@/lib/macros";

type BarcodeResult = {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  advice: string;
  product?: {
    barcode: string;
    brand: string | null;
    quantity: string | null;
    imageUrl: string | null;
  };
};

type Props = {
  onAddToDiary: (payload: {
    name: string;
    grams: number;
    caloriesPer100g: number;
    proteinPer100g: number | null;
    fatPer100g: number | null;
    carbsPer100g: number | null;
  }) => void;
};

export default function BarcodePanel({ onAddToDiary }: Props) {
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [grams, setGrams] = useState(100);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "barcode-reader";

  useEffect(() => {
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function startScanner() {
    setError(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 260, height: 140 } },
        async (decoded) => {
          const code = decoded.replace(/\D/g, "");
          if (code.length >= 8) {
            setBarcode(code);
            await stopScanner();
            await lookup(code);
          }
        },
        () => undefined,
      );
    } catch {
      setScanning(false);
      setError("无法打开摄像头，请检查权限，或改为手动输入条形码");
    }
  }

  async function lookup(code: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/food/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "查询失败");
      }
      setResult(data as BarcodeResult);
      setGrams(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    await lookup(code);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <p className="text-sm text-[var(--muted)]">
          扫描或输入包装食品条形码（Open Food Facts）
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))}
            placeholder="例如：6901234567890"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={loading || !barcode.trim()}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent-deep)" }}
          >
            {loading ? "查询中…" : "查询包装"}
          </button>
          <button
            type="button"
            onClick={() => (scanning ? stopScanner() : startScanner())}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--line)" }}
          >
            {scanning ? "关闭扫码" : "打开扫码"}
          </button>
        </div>
        <div
          id={scannerId}
          className={`mt-4 overflow-hidden rounded-xl ${scanning ? "block" : "hidden"}`}
        />
      </form>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "rgba(196,105,58,0.1)",
            color: "var(--warn)",
            border: "1px solid rgba(196,105,58,0.28)",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div className="border-b border-[var(--line)] px-5 py-5">
            <p className="text-sm text-[var(--muted)]">包装食品</p>
            <h3
              className="mt-1 text-2xl tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {result.name}
            </h3>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {result.product?.brand ? `品牌：${result.product.brand} · ` : ""}
              {result.product?.quantity
                ? `规格：${result.product.quantity} · `
                : ""}
              Open Food Facts
            </p>
          </div>
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-[var(--muted)]">每 100 克热量</p>
            <p
              className="mt-2 text-4xl font-semibold"
              style={{ color: "var(--accent)" }}
            >
              {result.caloriesPer100g}{" "}
              <span className="text-lg text-[var(--muted)]">kcal</span>
            </p>
          </div>
          <div className="border-t border-[var(--line)] px-5 py-5">
            <MacroBars
              protein={result.proteinPer100g}
              fat={result.fatPer100g}
              carbs={result.carbsPer100g}
            />
          </div>
          <div className="border-t border-[var(--line)] px-5 py-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {COMMON_PORTIONS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setGrams(preset.grams)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{
                    border: "1px solid var(--line)",
                    background:
                      grams === preset.grams
                        ? "rgba(47,107,79,0.12)"
                        : "transparent",
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={grams}
                onChange={(e) =>
                  setGrams(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-24 rounded-xl border border-[var(--line)] bg-white/50 px-3 py-2 text-sm outline-none"
              />
              <span className="text-sm text-[var(--muted)]">克</span>
              <span
                className="ml-auto text-xl font-semibold"
                style={{ color: "var(--accent)" }}
              >
                {caloriesFromGrams(result.caloriesPer100g, grams)} kcal
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onAddToDiary({
                  name: result.name,
                  grams,
                  caloriesPer100g: result.caloriesPer100g,
                  proteinPer100g: result.proteinPer100g,
                  fatPer100g: result.fatPer100g,
                  carbsPer100g: result.carbsPer100g,
                })
              }
              className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ background: "var(--accent-deep)" }}
            >
              加入今日饮食
            </button>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {result.advice}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
