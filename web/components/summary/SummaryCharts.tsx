import React from "react";
import Link from "next/link";
import type { SummaryAreaMetric, SummaryTrendPoint } from "../../lib/summary";

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

export function SummaryDonutChart({
  percent,
  completed,
  total,
}: {
  percent: number;
  completed: number;
  total: number;
}) {
  const safePercent = Math.max(0, Math.min(100, percent));
  const endAngle = Math.max(4, (safePercent / 100) * 359.9);
  const arcPath = describeArc(80, 80, 54, 0, endAngle);

  return (
    <div
      className="summary-donut-chart"
      aria-label={`${Math.round(safePercent)} percent complete, ${completed} of ${total} items finished`}
      role="img"
    >
      <svg
        viewBox="0 0 160 160"
        className="summary-donut-chart-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="summary-donut-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="var(--summary-ideas)" />
            <stop offset="45%" stopColor="var(--summary-features)" />
            <stop offset="100%" stopColor="var(--done)" />
          </linearGradient>
        </defs>
        <circle
          cx="80"
          cy="80"
          r="54"
          fill="none"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="18"
        />
        {safePercent > 0 ? (
          <path
            d={arcPath}
            fill="none"
            stroke="url(#summary-donut-gradient)"
            strokeWidth="18"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="summary-donut-chart-center">
        <strong>{Math.round(safePercent)}%</strong>
        <span>Complete</span>
      </div>
    </div>
  );
}

export function SummarySplitBarChart({
  areas,
  getHref,
}: {
  areas: SummaryAreaMetric[];
  getHref?: (key: SummaryAreaMetric["key"]) => string;
}) {
  const maxTotal = Math.max(1, ...areas.map((area) => area.total));

  return (
    <div
      className="summary-split-chart"
      role="img"
      aria-label="Project work split by area with completed and open segments"
    >
      {areas.map((area) => {
        const doneWidth =
          area.total === 0 ? 0 : (area.completed / maxTotal) * 100;
        const openWidth = area.total === 0 ? 0 : (area.open / maxTotal) * 100;
        const href = getHref?.(area.key);
        const rowContent = (
          <>
            <div className="summary-split-chart-head">
              <span className="summary-split-chart-label">{area.label}</span>
              <span className="summary-split-chart-meta">
                {area.completed}/{area.total}
              </span>
            </div>
            <div className="summary-split-chart-track">
              <div
                className="summary-split-chart-segment is-done"
                style={{
                  width: `${doneWidth}%`,
                  background: `var(${area.colorVar})`,
                }}
              />
              <div
                className="summary-split-chart-segment is-open"
                style={{
                  width: `${openWidth}%`,
                  borderColor: `color-mix(in srgb, var(${area.colorVar}) 48%, var(--border))`,
                  background: `color-mix(in srgb, var(${area.colorVar}) 18%, transparent)`,
                }}
              />
            </div>
          </>
        );

        if (href) {
          return (
            <Link
              key={area.key}
              href={href}
              prefetch={false}
              className="summary-split-chart-row summary-inline-link"
              aria-label={`Open ${area.label}`}
            >
              {rowContent}
            </Link>
          );
        }

        return (
          <div key={area.key} className="summary-split-chart-row">
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}

export function SummaryTrendChart({ points }: { points: SummaryTrendPoint[] }) {
  const width = 420;
  const height = 200;
  const padding = 18;
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [point.created, point.completedEstimate])
  );
  const stepX =
    points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const chartHeight = height - padding * 2;

  const toY = (value: number) =>
    height - padding - (value / maxValue) * chartHeight;
  const createdPolyline = points
    .map((point, index) => `${padding + index * stepX},${toY(point.created)}`)
    .join(" ");
  const completedPolyline = points
    .map(
      (point, index) =>
        `${padding + index * stepX},${toY(point.completedEstimate)}`
    )
    .join(" ");

  return (
    <div
      className="summary-trend-chart"
      role="img"
      aria-label="Seven day activity showing created items and completed items"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="summary-trend-chart-svg"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => {
          const y = padding + (chartHeight / 3) * index;
          return (
            <line
              key={index}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              className="summary-trend-chart-gridline"
            />
          );
        })}
        {points.map((point, index) => {
          const x = padding + index * stepX;
          return (
            <g key={point.dateKey}>
              <rect
                x={x - 8}
                y={toY(point.created)}
                width="16"
                height={height - padding - toY(point.created)}
                rx="6"
                className="summary-trend-chart-bar"
              />
            </g>
          );
        })}
        <polyline
          points={createdPolyline}
          fill="none"
          stroke="var(--summary-features)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={completedPolyline}
          fill="none"
          stroke="var(--done)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const x = padding + index * stepX;
          return (
            <React.Fragment key={`${point.dateKey}-dots`}>
              <circle
                cx={x}
                cy={toY(point.created)}
                r="4"
                fill="var(--summary-features)"
              />
              <circle
                cx={x}
                cy={toY(point.completedEstimate)}
                r="4"
                fill="var(--done)"
              />
            </React.Fragment>
          );
        })}
      </svg>
      <div className="summary-trend-chart-labels" aria-hidden="true">
        {points.map((point) => (
          <span key={point.dateKey}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}
