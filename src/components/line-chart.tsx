"use client";

import { useEffect, useRef, useState } from "react";
import { niceTicks } from "@/lib/chart";

export interface ChartPoint {
  date: string;
  value: number;
  /** Extra line in the tooltip, e.g. the best set of that session. */
  detail?: string;
}

const HEIGHT = 180;
const PAD = { top: 16, right: 16, bottom: 24, left: 40 };

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Single-series line chart, inline SVG. 2px line, 8px end marker, hairline
 * grid; tap or hover shows a crosshair and tooltip for the nearest session.
 */
export function LineChart({ points, unit, label }: { points: ChartPoint[]; unit: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const times = points.map((p) => Date.parse(p.date));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);

  const x = (i: number) => PAD.left + (tMax === tMin ? innerW / 2 : ((times[i] - tMin) / (tMax - tMin)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");

  function nearest(clientX: number) {
    const rect = box.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setActive(best);
  }

  const last = points.length - 1;
  const shown = active ?? null;

  return (
    <div
      ref={box}
      className="relative touch-pan-y select-none"
      onPointerMove={(e) => nearest(e.clientX)}
      onPointerDown={(e) => nearest(e.clientX)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
    >
      <svg width={width} height={HEIGHT} role="img" aria-label={`${label} por sessão`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
              {numberFormat.format(t)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 6} fontSize={11} fill="var(--muted)">
          {dateFormat.format(times[0])}
        </text>
        {last > 0 && (
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" fontSize={11} fill="var(--muted)">
            {dateFormat.format(times[last])}
          </text>
        )}

        <path d={`${path}L${x(last)},${PAD.top + innerH}L${x(0)},${PAD.top + innerH}Z`} fill="var(--accent)" opacity={0.08} />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {shown !== null && (
          <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--muted)" strokeWidth={1} />
        )}
        {(shown !== null ? [shown] : [last]).map((i) => (
          <circle key={i} cx={x(i)} cy={y(points[i].value)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        {shown === null && (
          <text
            x={Math.min(x(last), width - PAD.right)}
            y={y(points[last].value) - 12}
            textAnchor={x(last) > width - 60 ? "end" : "middle"}
            fontSize={12}
            fontWeight={600}
            fill="var(--foreground)"
          >
            {numberFormat.format(points[last].value)} {unit}
          </text>
        )}
      </svg>

      {shown !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg shadow-black/40"
          style={{
            left: Math.min(Math.max(x(shown) - 70, 0), width - 140),
            width: 140,
          }}
        >
          <p className="text-muted">{dateFormat.format(times[shown])}</p>
          <p className="font-semibold text-foreground">
            {numberFormat.format(points[shown].value)} {unit}
          </p>
          {points[shown].detail && <p className="text-muted">{points[shown].detail}</p>}
        </div>
      )}
    </div>
  );
}
