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
    { label: "蛋白质", value: protein, color: "var(--protein)" },
    { label: "脂肪", value: fat, color: "var(--fat)" },
    { label: "碳水", value: carbs, color: "var(--carbs)" },
  ];

  const max = Math.max(...items.map((item) => item.value ?? 0), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="display text-sm tracking-tight">宏量营养素</p>
        <p className="text-xs text-[var(--muted)]">{unitLabel}</p>
      </div>
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{item.label}</span>
            <span>{item.value == null ? "—" : `${item.value} g`}</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ background: "rgba(20,32,27,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
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
