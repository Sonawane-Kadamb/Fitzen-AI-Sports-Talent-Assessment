/**
 * Hand-rolled SVG charts — no charting dependency, fully themed via CSS
 * variables, resolution-independent, and cheap to render.
 */

import { useId, useMemo, useState } from 'react';

export interface SeriesPoint {
  x: number; // epoch ms
  y: number;
  ciLow?: number;
  ciHigh?: number;
  label?: string;
}

function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/**
 * Area line chart with optional confidence band and hover inspection.
 */
export function TrendChart({
  points,
  height = 220,
  yFormat = (v) => v.toFixed(0),
  ariaLabel = 'Trend chart',
}: {
  points: SeriesPoint[];
  height?: number;
  yFormat?: (v: number) => string;
  ariaLabel?: string;
}) {
  const gradientId = useId();
  const width = 720;
  const pad = { top: 18, right: 16, bottom: 26, left: 44 };
  const [hover, setHover] = useState<number | null>(null);

  const { linePath, areaPath, bandPath, xs, ys, ticks } = useMemo(() => {
    if (points.length === 0) {
      return { linePath: '', areaPath: '', bandPath: '', xs: [] as number[], ys: [] as number[], ticks: [] as number[] };
    }
    const xVals = points.map((p) => p.x);
    const yLows = points.map((p) => p.ciLow ?? p.y);
    const yHighs = points.map((p) => p.ciHigh ?? p.y);
    const yMin = Math.min(...yLows);
    const yMax = Math.max(...yHighs);
    const yPadding = Math.max((yMax - yMin) * 0.18, yMax * 0.05 || 1);
    const sx = scale([Math.min(...xVals), Math.max(...xVals)], [pad.left, width - pad.right]);
    const sy = scale([yMin - yPadding, yMax + yPadding], [height - pad.bottom, pad.top]);

    const xs = points.map((p) => sx(p.x));
    const ys = points.map((p) => sy(p.y));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs[i]!.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ');
    const area = `${line} L${xs[xs.length - 1]!.toFixed(1)},${height - pad.bottom} L${xs[0]!.toFixed(1)},${height - pad.bottom} Z`;

    let band = '';
    if (points.some((p) => p.ciLow !== undefined && p.ciHigh !== undefined)) {
      const upper = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs[i]!.toFixed(1)},${sy(p.ciHigh ?? p.y).toFixed(1)}`).join(' ');
      const lower = [...points].reverse()
        .map((p, i) => `L${xs[points.length - 1 - i]!.toFixed(1)},${sy(p.ciLow ?? p.y).toFixed(1)}`)
        .join(' ');
      band = `${upper} ${lower} Z`;
    }

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount }, (_, i) =>
      yMin - yPadding + ((yMax + yPadding - (yMin - yPadding)) * (i + 0.5)) / tickCount,
    );
    return { linePath: line, areaPath: area, bandPath: band, xs, ys, ticks };
  }, [points, height]);

  if (points.length === 0) return null;

  const yLowAll = Math.min(...points.map((p) => p.ciLow ?? p.y));
  const yHighAll = Math.max(...points.map((p) => p.ciHigh ?? p.y));
  const yPad2 = Math.max((yHighAll - yLowAll) * 0.18, yHighAll * 0.05 || 1);
  const syTicks = scale([yLowAll - yPad2, yHighAll + yPad2], [height - pad.bottom, pad.top]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="fz-chart"
      role="img"
      aria-label={ariaLabel}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * width;
        let best = 0;
        let bestDist = Infinity;
        xs.forEach((x, i) => {
          const dist = Math.abs(x - px);
          if (dist < bestDist) { bestDist = dist; best = i; }
        });
        setHover(best);
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-fill-from)" />
          <stop offset="100%" stopColor="var(--chart-fill-to)" />
        </linearGradient>
      </defs>

      {ticks.map((tick, i) => (
        <g key={i}>
          <line x1={pad.left} x2={width - pad.right} y1={syTicks(tick)} y2={syTicks(tick)}
            stroke="var(--border)" strokeDasharray="3 5" strokeWidth="1" />
          <text x={pad.left - 8} y={syTicks(tick) + 4} textAnchor="end" className="fz-chart__tick">
            {yFormat(tick)}
          </text>
        </g>
      ))}

      {bandPath ? <path d={bandPath} fill="var(--chart-fill-from)" opacity="0.5" /> : null}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke="var(--chart-line)" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={hover === i ? 5.5 : 3}
          fill={hover === i ? 'var(--chart-line)' : 'var(--bg-elevated)'}
          stroke="var(--chart-line)" strokeWidth="2" />
      ))}

      {hover !== null && points[hover] ? (
        <g>
          <line x1={xs[hover]} x2={xs[hover]} y1={pad.top} y2={height - pad.bottom}
            stroke="var(--border-strong)" strokeWidth="1" />
          <g transform={`translate(${Math.min(xs[hover]! + 10, width - 150)}, ${pad.top})`}>
            <rect width="140" height="46" rx="8" fill="var(--bg-raised)" stroke="var(--border-strong)" />
            <text x="10" y="19" className="fz-chart__tip-strong">{yFormat(points[hover]!.y)}</text>
            <text x="10" y="36" className="fz-chart__tip">
              {points[hover]!.label ?? new Date(points[hover]!.x).toLocaleDateString()}
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

/**
 * Compact bar chart for component scores / weekly volume.
 */
export function Bars({
  data,
  height = 150,
  ariaLabel = 'Bar chart',
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  ariaLabel?: string;
}) {
  const width = 720;
  const pad = { top: 10, right: 8, bottom: 26, left: 8 };
  const max = Math.max(...data.map((d) => d.value), 1);
  const innerW = width - pad.left - pad.right;
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.min(46, step * 0.55);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="fz-chart" role="img" aria-label={ariaLabel}>
      {data.map((d, i) => {
        const h = ((height - pad.top - pad.bottom) * d.value) / max;
        const x = pad.left + step * i + (step - barW) / 2;
        const y = height - pad.bottom - h;
        return (
          <g key={d.label + i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 2)} rx="6"
              fill="var(--chart-line)" opacity={0.55 + 0.45 * (d.value / max)} />
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="fz-chart__tick">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Tiny inline sparkline for table rows. */
export function Sparkline({ values, width = 110, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="fz-chart__tick">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sx = scale([0, values.length - 1], [2, width - 2]);
  const sy = scale([min, max === min ? min + 1 : max], [height - 3, 3]);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke="var(--chart-line)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
