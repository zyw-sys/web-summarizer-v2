type Point = {
  label: string;
  value: number | null;
};

type Props = {
  points: Point[];
  color?: string;
  height?: number;
  unit?: string;
  emptyText?: string;
};

export default function SimpleChart({
  points,
  color = "#2f6b4f",
  height = 160,
  unit = "",
  emptyText = "暂无数据",
}: Props) {
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v != null && !Number.isNaN(v));

  if (values.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl text-sm text-[var(--muted)]"
        style={{ height, background: "rgba(28,43,34,0.03)" }}
      >
        {emptyText}
      </div>
    );
  }

  const width = 320;
  const padding = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points
    .map((point, index) => {
      if (point.value == null) return null;
      const x =
        padding +
        (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y =
        padding +
        (1 - (point.value - min) / span) * (height - padding * 2);
      return { x, y, ...point };
    })
    .filter(Boolean) as Array<Point & { x: number; y: number }>;

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="趋势图"
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((point) => (
          <circle
            key={`${point.label}-${point.x}`}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill={color}
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
        <span>
          {points[0]?.label}
          {unit ? ` ${unit}` : ""}
        </span>
        <span>
          最低 {min}
          {unit} · 最高 {max}
          {unit}
        </span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
