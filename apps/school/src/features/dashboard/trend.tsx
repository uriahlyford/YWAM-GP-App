"use client";

import { useId, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { formatDate, formatPercent } from "@/lib/i18n";
import type { DateOnly } from "@/lib/date";

/**
 * Attendance rate over the last few school days.
 *
 * One series, so no legend — the card's own title says what is plotted. Line at
 * 2px with a 10%-opacity wash under it, hairline gridlines a step off the
 * surface, and only the endpoint carries a direct label; the rest of the values
 * come from the crosshair and the table below, so nothing is gated behind a
 * hover a touch user cannot perform.
 *
 * Days with no register taken anywhere are absent from the series rather than
 * plotted as zero — a holiday is not a day when nobody came.
 */

export type TrendPoint = { date: DateOnly; rate: number; marked: number };

// The viewBox aspect ratio decides the rendered height, because the svg is width
// driven. A fixed pixel height plus `w-full` letterboxes it: the default
// `preserveAspectRatio` scales to fit *both* axes, so a 160px-tall box caps the
// width at 640px and centres it inside a wider card.
const WIDTH = 720;
const HEIGHT = 150;
const PAD = { top: 12, right: 16, bottom: 22, left: 34 };

export function AttendanceTrend({ points }: { points: TrendPoint[] }) {
  const t = useT();
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  if (points.length < 2) return null;

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  // Fixed 0–100% scale. An auto-scaled y-axis makes a drop from 98% to 96% look
  // like a collapse, which is the most common way a chart lies.
  const x = (index: number) =>
    PAD.left + (plotWidth * index) / (points.length - 1);
  const y = (rate: number) => PAD.top + plotHeight * (1 - rate);

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.rate)}`)
    .join(" ");

  const area = `${line} L${x(points.length - 1)},${PAD.top + plotHeight} L${PAD.left},${PAD.top + plotHeight} Z`;

  const last = points[points.length - 1];
  const shown = active === null ? last : points[active];
  const shownIndex = active === null ? points.length - 1 : active;

  return (
    <figure className="m-0">
      {/* In normal flow above the plot rather than floated over it: pinned to a
          corner, the readout covered the line end exactly when the reader
          crosshaired the most recent day. Value first — the reader has the
          series and wants the number. */}
      <p className="mb-1 text-sm" aria-live="polite">
        <strong className="tabular-nums text-ink-900">
          {formatPercent(t.locale, shown.rate)}
        </strong>
        <span className="ms-1.5 text-ink-500">{formatDate(t, shown.date)}</span>
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block w-full touch-none"
          role="img"
          aria-label={t("dash.trend.label")}
          onPointerLeave={() => setActive(null)}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - box.left) / box.width;
            const svgX = ratio * WIDTH;
            // Snap to the nearest day: the reader aims at a date, never at a
            // 2px line.
            const nearest = Math.round(
              ((svgX - PAD.left) / plotWidth) * (points.length - 1),
            );
            setActive(Math.min(points.length - 1, Math.max(0, nearest)));
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-600)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-brand-600)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.5, 0.85, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-ink-200)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-ink-400 text-[10px] tabular-nums"
              >
                {Math.round(tick * 100)}
              </text>
            </g>
          ))}

          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--color-brand-600)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              stroke="var(--color-ink-300)"
              strokeWidth="1"
            />
          ) : null}

          {/* 2px surface ring, so the marker stays legible where it crosses the
              line or a gridline. */}
          <circle
            cx={x(shownIndex)}
            cy={y(shown.rate)}
            r="4.5"
            fill="var(--color-brand-600)"
            stroke="var(--color-ink-50)"
            strokeWidth="2"
          />

          <text
            x={PAD.left}
            y={HEIGHT - 6}
            className="fill-ink-400 text-[10px]"
          >
            {points[0].date.slice(5)}
          </text>
          <text
            x={WIDTH - PAD.right}
            y={HEIGHT - 6}
            textAnchor="end"
            className="fill-ink-400 text-[10px]"
          >
            {last.date.slice(5)}
          </text>
        </svg>

      </div>

      {/* Every plotted value, reachable without hovering. */}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-ink-500">
          {t("dash.trend.table")}
        </summary>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-ink-500">
              <th scope="col" className="py-1 text-start font-medium">
                {t("common.date")}
              </th>
              <th scope="col" className="py-1 text-end font-medium">
                {t("dash.attendanceRate")}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date} className="border-t border-ink-100">
                <td className="py-1 text-ink-700">{formatDate(t, point.date)}</td>
                <td className="py-1 text-end tabular-nums text-ink-900">
                  {formatPercent(t.locale, point.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
