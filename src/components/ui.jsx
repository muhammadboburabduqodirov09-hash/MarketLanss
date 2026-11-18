"use client";

import { LoaderCircle } from "lucide-react";
import { formatUzbekDate } from "@/lib/translations";

export function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = "", ...props }) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, note, icon: Icon }) {
  return (
    <Card className="stat-card">
      <div className="stat-top"><span>{label}</span>{Icon && <Icon size={17} aria-hidden="true" />}</div>
      <strong>{value}</strong>{note && <small>{note}</small>}
    </Card>
  );
}

export function EmptyState({ title, description, action }) {
  return <div className="empty-state"><div className="empty-icon">↗</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function LoadingState({ label }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={18} />{label}</div>;
}

export function ErrorMessage({ children }) {
  return children ? <div className="message message-error" role="alert">{children}</div> : null;
}

export function SuccessMessage({ children }) {
  return children ? <div className="message message-success" role="status">{children}</div> : null;
}

export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// Cached per locale: CountUp formats on every animation frame.
const moneyFormats = {};
export function formatMoney(value, language = "en") {
  const locale = language === "uz" ? "uz-UZ" : language === "ru" ? "ru-RU" : "en-US";
  moneyFormats[locale] ??= new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moneyFormats[locale].format(value ?? 0);
}

export function formatDate(value, language = "en") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (language === "uz") return formatUzbekDate(date);
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  }).format(date);
}
