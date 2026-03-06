import React from "react";
import Link from "next/link";

export function SummaryStatCard({
  title,
  value,
  detail,
  accentClassName,
  href,
}: {
  title: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  accentClassName: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="summary-stat-card-title">{title}</p>
      <strong className="summary-stat-card-value">{value}</strong>
      <p className="summary-stat-card-detail">{detail}</p>
    </>
  );

  if (!href) {
    return (
      <article className={`summary-stat-card ${accentClassName}`}>
        {content}
      </article>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className={`summary-stat-card summary-link-card ${accentClassName}`}
      aria-label={`Open ${title}`}
    >
      {content}
    </Link>
  );
}
