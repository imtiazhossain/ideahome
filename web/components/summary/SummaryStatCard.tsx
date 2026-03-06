import React from "react";

export function SummaryStatCard({
  title,
  value,
  detail,
  accentClassName,
}: {
  title: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  accentClassName: string;
}) {
  return (
    <article className={`summary-stat-card ${accentClassName}`}>
      <p className="summary-stat-card-title">{title}</p>
      <strong className="summary-stat-card-value">{value}</strong>
      <p className="summary-stat-card-detail">{detail}</p>
    </article>
  );
}
