type Props = {
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  unitLabel?: string;
};

export default function MacroBars({
  protein,
  fat,
  carbs,
  unitLabel = "g/100g",
}: Props) {
  const items = [
    { label: "蛋白质", value: protein, color: "#2f6b4f" },
    { label: "脂肪", value: fat, color: "#c4693a" },
    { label: "碳水", value: carbs, color: "#3b6d8f" },
  ];

  const max = Math.max(
    ...items.map((item) => item.value ?? 0),
    1,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p
          className="text-sm tracking-tight"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          宏量营养素
        </p>
        <p className="text-xs text-[var(--muted)]">{unitLabel}</p>
      </div>
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{item.label}</span>
            <span>{item.value == null ? "—" : `${item.value} g`}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "rgba(28,43,34,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((item.value ?? 0) / max) * 100)}%`,
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
